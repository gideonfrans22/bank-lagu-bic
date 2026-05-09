import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronDown, ChevronUp } from "lucide-react";
import { SongPicker, type SongPickerSelection } from "@/components/SongPicker";
import type { Service, SetlistItem, Song } from "@/types/database";
import { supabase } from "@/lib/supabase";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type LineState = {
  key: string;
  itemId?: string;
  picker: SongPickerSelection;
  musical_key: string;
  notes: string;
};

function newLine(): LineState {
  return {
    key: crypto.randomUUID(),
    picker: { song: null, draftTitle: "" },
    musical_key: "",
    notes: "",
  };
}

export default function ServiceEdit({ canEdit }: { canEdit: boolean }) {
  const { serviceDate } = useParams<{ serviceDate: string }>();
  const [service, setService] = useState<Service | null>(null);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineState[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const date = serviceDate ?? "";

  const validDate = useMemo(() => /^\d{4}-\d{2}-\d{2}$/.test(date), [date]);

  const load = useCallback(async () => {
    if (!validDate) {
      setLoading(false);
      setError("Invalid date in URL.");
      return;
    }
    setLoading(true);
    setError(null);
    const { data: svc, error: svcErr } = await supabase
      .from("services")
      .select("*")
      .eq("service_date", date)
      .maybeSingle();
    if (svcErr) {
      setError(svcErr.message);
      setLoading(false);
      return;
    }
    const s = svc as Service | null;
    setService(s);
    setTitle(s?.title ?? "");
    setNotes(s?.notes ?? "");

    if (s) {
      const { data: items, error: itemsErr } = await supabase
        .from("setlist_items")
        .select("*, songs (*)")
        .eq("service_id", s.id)
        .order("position", { ascending: true });
      if (itemsErr) {
        setError(itemsErr.message);
        setLines([]);
      } else {
        const mapped = (items as (SetlistItem & { songs: Song })[]).map((row) => ({
          key: row.id,
          itemId: row.id,
          picker: { song: row.songs, draftTitle: row.songs.title },
          musical_key: row.musical_key ?? "",
          notes: row.notes ?? "",
        }));
        setLines(mapped.length ? mapped : [newLine()]);
      }
    } else {
      setLines([newLine()]);
    }
    setLoading(false);
  }, [date, validDate]);

  useEffect(() => {
    void load();
  }, [load]);

  function moveLine(index: number, dir: -1 | 1) {
    setLines((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      const tmp = next[index];
      next[index] = next[j]!;
      next[j] = tmp!;
      return next;
    });
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    if (!validDate) return;
    setSaving(true);
    setError(null);
    setInfo(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    let svc = service;

    if (!svc) {
      const { data: created, error: cErr } = await supabase
        .from("services")
        .insert({
          service_date: date,
          title: title.trim() || null,
          notes: notes.trim() || null,
          created_by: user?.id ?? null,
        })
        .select("*")
        .single();
      if (cErr) {
        setSaving(false);
        setError(cErr.message);
        return;
      }
      svc = created as Service;
      setService(svc);
    } else {
      const { error: uErr } = await supabase
        .from("services")
        .update({
          title: title.trim() || null,
          notes: notes.trim() || null,
        })
        .eq("id", svc.id);
      if (uErr) {
        setSaving(false);
        setError(uErr.message);
        return;
      }
    }

    const readyLines = lines
      .map((line, idx) => ({ line, position: idx + 1 }))
      .filter(({ line }) => line.picker.song);

    const { error: delErr } = await supabase.from("setlist_items").delete().eq("service_id", svc!.id);
    if (delErr) {
      setSaving(false);
      setError(delErr.message);
      return;
    }

    if (readyLines.length) {
      const songArtistById = new Map<string, string | null>();
      for (const { line } of readyLines) {
        const s = line.picker.song;
        if (!s) continue;
        const artist = s.artist?.trim() ? s.artist.trim() : null;
        songArtistById.set(s.id, artist);
      }
      const songUpdateResults = await Promise.all(
        [...songArtistById.entries()].map(([songId, artist]) =>
          supabase.from("songs").update({ artist }).eq("id", songId)
        )
      );
      const songErr = songUpdateResults.find((r) => r.error)?.error;
      if (songErr) {
        setSaving(false);
        setError(songErr.message);
        return;
      }

      const rows = readyLines.map(({ line, position }) => ({
        service_id: svc!.id,
        position,
        song_id: line.picker.song!.id,
        artist_or_source: null,
        musical_key: line.musical_key.trim() || null,
        notes: line.notes.trim() || null,
      }));
      const { error: insErr } = await supabase.from("setlist_items").insert(rows);
      if (insErr) {
        setSaving(false);
        setError(insErr.message);
        return;
      }
    }

    setSaving(false);
    setInfo("Saved.");
    await load();
  }

  if (!validDate && !loading) {
    return (
      <div className="space-y-3">
        <Alert variant="destructive">
          <AlertTitle>Invalid URL</AlertTitle>
          <AlertDescription>Use /service/YYYY-MM-DD</AlertDescription>
        </Alert>
        <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }))} to="/">
          Home
        </Link>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle>Sunday {date}</CardTitle>
          <CardDescription>
            {!canEdit ? "Your account can view data but cannot edit setlists." : "Save when you finish editing."}
          </CardDescription>
        </div>
        <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")} to="/">
          Dashboard
        </Link>
      </CardHeader>
      <Separator />
      <CardContent className="space-y-4 pt-6">
        {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {info ? (
          <Alert>
            <AlertTitle>Saved</AlertTitle>
            <AlertDescription>{info}</AlertDescription>
          </Alert>
        ) : null}

        {!loading && (
          <form className="space-y-6" onSubmit={(e) => void onSave(e)}>
            <div className="space-y-2">
              <Label htmlFor="svc-title">Service title (optional)</Label>
              <Input
                id="svc-title"
                type="text"
                disabled={!canEdit}
                value={title}
                placeholder="e.g. Easter Sunday"
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="svc-notes">Notes (optional)</Label>
              <Textarea
                id="svc-notes"
                disabled={!canEdit}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-medium">Setlist</h3>
              <p className="text-sm text-muted-foreground">
                Search existing songs or create a new canonical title — counts use the linked song record.
              </p>
            </div>

            {lines.map((line, index) => (
              <div
                key={line.key}
                className="grid gap-3 rounded-xl border bg-muted/30 p-4 sm:grid-cols-[minmax(0,1fr)_5.5rem_auto] sm:items-end"
              >
                <SongPicker
                  disabled={!canEdit}
                  selection={line.picker}
                  onChange={(picker) =>
                    setLines((prev) => {
                      const next = [...prev];
                      next[index] = { ...next[index]!, picker };
                      return next;
                    })
                  }
                />
                <div className="space-y-2">
                  <Label>Key</Label>
                  <Input
                    type="text"
                    disabled={!canEdit}
                    placeholder="Bb"
                    value={line.musical_key}
                    onChange={(e) =>
                      setLines((prev) => {
                        const next = [...prev];
                        next[index] = { ...next[index]!, musical_key: e.target.value };
                        return next;
                      })
                    }
                  />
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-xs"
                    disabled={!canEdit}
                    title="Move up"
                    onClick={() => moveLine(index, -1)}
                  >
                    <ChevronUp />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-xs"
                    disabled={!canEdit}
                    title="Move down"
                    onClick={() => moveLine(index, 1)}
                  >
                    <ChevronDown />
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={!canEdit}
                    onClick={() =>
                      setLines((prev) => {
                        const next = prev.filter((_, i) => i !== index);
                        return next.length ? next : [newLine()];
                      })
                    }
                  >
                    Remove
                  </Button>
                </div>
                <div className="space-y-2 sm:col-span-3">
                  <Label htmlFor={`src-${line.key}`}>Artist (optional)</Label>
                  <Input
                    id={`src-${line.key}`}
                    type="text"
                    disabled={!canEdit || !line.picker.song}
                    placeholder={
                      line.picker.song ? undefined : "Choose or create a song to set the artist"
                    }
                    value={line.picker.song?.artist ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      const songId = line.picker.song?.id;
                      if (!songId) return;
                      setLines((prev) =>
                        prev.map((l) => {
                          if (l.picker.song?.id !== songId) return l;
                          return {
                            ...l,
                            picker: {
                              ...l.picker,
                              song: { ...l.picker.song!, artist: v },
                            },
                          };
                        })
                      );
                    }}
                  />
                </div>
                <div className="space-y-2 sm:col-span-3">
                  <Label htmlFor={`ln-${line.key}`}>Line notes (optional)</Label>
                  <Textarea
                    id={`ln-${line.key}`}
                    disabled={!canEdit}
                    value={line.notes}
                    onChange={(e) =>
                      setLines((prev) => {
                        const next = [...prev];
                        next[index] = { ...next[index]!, notes: e.target.value };
                        return next;
                      })
                    }
                  />
                </div>
              </div>
            ))}

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={!canEdit} onClick={() => setLines((prev) => [...prev, newLine()])}>
                Add song
              </Button>
            </div>

            {canEdit ? (
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save setlist"}
              </Button>
            ) : null}
          </form>
        )}
      </CardContent>
    </Card>
  );
}
