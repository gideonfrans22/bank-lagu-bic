import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Popover } from "@base-ui/react/popover";
import type { Song } from "@/types/database";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export type SongPickerSelection = {
  song: Song | null;
  /** Pending text before a canonical song is chosen or created */
  draftTitle: string;
};

type SongPickerProps = {
  selection: SongPickerSelection;
  onChange: (next: SongPickerSelection) => void;
  disabled?: boolean;
};

function sanitizeSearch(q: string) {
  /* Strip chars that break PostgREST `.or()` CSV syntax; LIKE wildcards escaped. */
  return q
    .trim()
    .replace(/"/g, "")
    .replace(/,/g, " ")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
    .slice(0, 120);
}

function lyricsSnippetMatches(lyrics: string | null, rawQuery: string) {
  const q = rawQuery.trim().toLowerCase();
  if (!lyrics || !q) return false;
  return lyrics.toLowerCase().includes(q);
}

/**
 * Pick an existing canonical song or create one inline so every line has a stable `song_id`.
 */
export function SongPicker({ selection, onChange, disabled }: SongPickerProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hits, setHits] = useState<Song[]>([]);

  const displayValue = selection.song?.title ?? selection.draftTitle;

  const runSearch = useCallback(async (raw: string) => {
    const q = sanitizeSearch(raw);
    setLoading(true);
    setError(null);

    if (q.length < 1) {
      const { data, error: reqErr } = await supabase
        .from("songs")
        .select("*")
        .order("title", { ascending: true })
        .limit(25);
      setLoading(false);
      if (reqErr) {
        setError(reqErr.message);
        setHits([]);
        return;
      }
      setHits(data ?? []);
      return;
    }

    const pattern = `%${q}%`;
    const orFilter = [
      `title.ilike.${pattern}`,
      `subtitle.ilike.${pattern}`,
      `artist.ilike.${pattern}`,
      `lyrics.ilike.${pattern}`,
    ].join(",");

    const { data, error: reqErr } = await supabase
      .from("songs")
      .select("*")
      .or(orFilter)
      .order("title", { ascending: true })
      .limit(25);
    setLoading(false);
    if (reqErr) {
      setError(reqErr.message);
      setHits([]);
      return;
    }
    setHits(data ?? []);
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      void runSearch(selection.draftTitle);
    }, 200);
    return () => window.clearTimeout(t);
  }, [selection.draftTitle, open, runSearch]);

  const canCreate = useMemo(() => {
    const t = selection.draftTitle.trim();
    if (!t) return false;
    if (selection.song && selection.song.title.trim() === t) return false;
    const exact = hits.some(
      (h) => h.title.localeCompare(t, undefined, { sensitivity: "base" }) === 0
    );
    return !exact;
  }, [hits, selection.draftTitle, selection.song]);

  async function createSong() {
    const title = selection.draftTitle.trim();
    if (!title) return;
    setCreating(true);
    setError(null);
    const { data, error: insErr } = await supabase
      .from("songs")
      .insert({ title })
      .select("*")
      .single();
    setCreating(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    if (data) {
      onChange({ song: data as Song, draftTitle: data.title });
      setOpen(false);
      setHits([]);
    }
  }

  function pickSong(song: Song) {
    onChange({ song, draftTitle: song.title });
    setOpen(false);
    setHits([]);
  }

  const showEmpty =
    !loading && hits.length === 0 && selection.draftTitle.trim().length > 0;
  const showDefaultEmpty =
    !loading && hits.length === 0 && selection.draftTitle.trim().length === 0;

  return (
    <Popover.Root open={open} onOpenChange={setOpen} modal={false}>
      <div ref={anchorRef} className="w-full space-y-2">
        <Label htmlFor="song-search">Song</Label>
        <Input
          id="song-search"
          type="text"
          autoComplete="off"
          disabled={disabled}
          placeholder="Search title, subtitle, artist, or lyrics…"
          value={displayValue}
          onChange={(e) => {
            const v = e.target.value;
            onChange({ song: null, draftTitle: v });
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
      </div>
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="start"
          sideOffset={4}
          anchor={anchorRef}
          className="isolate z-50 outline-none"
        >
          <Popover.Popup
            initialFocus={false}
            className={cn(
              "max-h-[min(280px,70vh)] w-[max(var(--anchor-width),min(24rem,calc(100vw-2.5rem)))] overflow-hidden rounded-lg border bg-popover p-0 text-popover-foreground shadow-md ring-1 ring-foreground/10",
              "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
              "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
              "origin-(--transform-origin)"
            )}
          >
            <Command shouldFilter={false} className="max-h-[min(280px,70vh)]">
              <CommandList>
                {loading ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">Searching…</div>
                ) : null}
                {!loading && showEmpty ? (
                  <CommandEmpty>No matches. You can create this song below.</CommandEmpty>
                ) : null}
                {!loading && showDefaultEmpty ? (
                  <CommandEmpty>No songs in the library yet.</CommandEmpty>
                ) : null}
                <CommandGroup>
                  {hits.map((h) => (
                    <CommandItem
                      key={h.id}
                      value={`${h.id}\t${h.title}`}
                      onSelect={() => pickSong(h)}
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
                        <span className="font-medium">{h.title}</span>
                        {h.artist ? (
                          <span className="text-xs text-muted-foreground">{h.artist}</span>
                        ) : null}
                        {h.subtitle ? (
                          <span className="text-xs text-muted-foreground">{h.subtitle}</span>
                        ) : null}
                        {lyricsSnippetMatches(h.lyrics, selection.draftTitle) ? (
                          <span className="text-xs text-muted-foreground">Lyrics match</span>
                        ) : null}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
                {canCreate ? (
                  <>
                    <CommandSeparator />
                    <div className="p-2">
                      <Button
                        type="button"
                        className="w-full"
                        size="sm"
                        disabled={creating || disabled}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => void createSong()}
                      >
                        {creating ? "Creating…" : `Create “${selection.draftTitle.trim()}”`}
                      </Button>
                    </div>
                  </>
                ) : null}
              </CommandList>
            </Command>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
      {error ? (
        <Alert variant="destructive" className="mt-2">
          <AlertTitle>Search</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </Popover.Root>
  );
}
