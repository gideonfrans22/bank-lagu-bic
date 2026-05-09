import { Fragment, useEffect, useState } from "react";
import type { SongPlayCount } from "@/types/database";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

type Props = { canEdit: boolean };

export default function SongStats({ canEdit }: Props) {
  const [rows, setRows] = useState<SongPlayCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftArtist, setDraftArtist] = useState("");
  const [draftLyrics, setDraftLyrics] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  async function loadRows() {
    setError(null);
    const { data, error: reqErr } = await supabase
      .from("song_play_counts")
      .select("*")
      .order("line_appearances", { ascending: false })
      .limit(500);
    if (reqErr) {
      setError(reqErr.message);
    } else {
      setRows((data as SongPlayCount[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error: reqErr } = await supabase
        .from("song_play_counts")
        .select("*")
        .order("line_appearances", { ascending: false })
        .limit(500);
      if (cancelled) return;
      if (reqErr) {
        setError(reqErr.message);
      } else {
        setRows((data as SongPlayCount[]) ?? []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function startEdit(r: SongPlayCount) {
    setSaveMsg(null);
    setEditingId(r.song_id);
    setDraftArtist(r.artist ?? "");
    setDraftLyrics(r.lyrics ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setDraftArtist("");
    setDraftLyrics("");
  }

  async function saveEdit(songId: string) {
    setSavingId(songId);
    setSaveMsg(null);
    setError(null);
    const payload = {
      artist: draftArtist.trim() || null,
      lyrics: draftLyrics.trim() || null,
    };
    const { error: upErr } = await supabase.from("songs").update(payload).eq("id", songId);
    setSavingId(null);
    if (upErr) {
      setError(upErr.message);
      return;
    }
    setEditingId(null);
    setSaveMsg("Saved.");
    await loadRows();
  }

  const filtered = rows.filter((r) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return (
      r.title.toLowerCase().includes(s) ||
      (r.subtitle ?? "").toLowerCase().includes(s) ||
      (r.artist ?? "").toLowerCase().includes(s) ||
      (r.lyrics ?? "").toLowerCase().includes(s)
    );
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Song frequency</CardTitle>
        <CardDescription>
          <strong>Line appearances</strong> counts every row in a setlist (same song twice in one Sunday
          counts twice). <strong>Sundays</strong> counts distinct service dates that included the song.
          {canEdit ? (
            <>
              {" "}
              Edit <strong>artist</strong> and <strong>lyrics</strong> here to power search in the setlist
              picker.
            </>
          ) : (
            <> Your account cannot edit catalog fields.</>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="filter-song">Filter</Label>
          <Input
            id="filter-song"
            type="search"
            placeholder="Title, subtitle, artist, lyrics…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : null}
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {saveMsg ? (
          <Alert>
            <AlertTitle>Saved</AlertTitle>
            <AlertDescription>{saveMsg}</AlertDescription>
          </Alert>
        ) : null}
        {!loading && !error ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Song</TableHead>
                <TableHead>Sundays</TableHead>
                <TableHead>Lines</TableHead>
                {canEdit ? <TableHead>Catalog</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <Fragment key={r.song_id}>
                  <TableRow className="align-top">
                    <TableCell className="max-w-[min(28rem,50vw)] whitespace-normal">
                      <div className="font-medium">{r.title}</div>
                      {r.subtitle ? <div className="text-sm text-muted-foreground">{r.subtitle}</div> : null}
                      {(r.artist || r.lyrics) && editingId !== r.song_id ? (
                        <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                          {r.artist ? <div>Artist: {r.artist}</div> : null}
                          {r.lyrics ? (
                            <div className="max-h-[3.2em] overflow-hidden leading-snug">
                              Lyrics: {r.lyrics.slice(0, 120)}
                              {r.lyrics.length > 120 ? "…" : ""}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>{r.sundays_count}</TableCell>
                    <TableCell>{r.line_appearances}</TableCell>
                    {canEdit ? (
                      <TableCell className="whitespace-normal">
                        {editingId !== r.song_id ? (
                          <Button type="button" variant="outline" size="sm" onClick={() => startEdit(r)}>
                            Edit
                          </Button>
                        ) : null}
                      </TableCell>
                    ) : null}
                  </TableRow>
                  {canEdit && editingId === r.song_id ? (
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableCell className="whitespace-normal" colSpan={4}>
                        <div className="grid max-w-xl gap-4 py-2">
                          <div className="space-y-2">
                            <Label htmlFor={`artist-${r.song_id}`}>Artist</Label>
                            <Input
                              id={`artist-${r.song_id}`}
                              type="text"
                              value={draftArtist}
                              onChange={(e) => setDraftArtist(e.target.value)}
                              placeholder="Composer / band / hymnbook attribution"
                              autoComplete="off"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`lyrics-${r.song_id}`}>Lyrics</Label>
                            <Textarea
                              id={`lyrics-${r.song_id}`}
                              rows={6}
                              value={draftLyrics}
                              onChange={(e) => setDraftLyrics(e.target.value)}
                              placeholder="Optional lyric text used for catalog search."
                            />
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              disabled={savingId === r.song_id}
                              onClick={() => void saveEdit(r.song_id)}
                            >
                              {savingId === r.song_id ? "Saving…" : "Save"}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              disabled={savingId === r.song_id}
                              onClick={cancelEdit}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </CardContent>
    </Card>
  );
}
