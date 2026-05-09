import { type ComponentProps, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DayButton } from "react-day-picker";
import {
  addDays,
  endOfMonth,
  format,
  startOfMonth,
  subDays,
} from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import { supabase } from "@/lib/supabase";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "react-day-picker";

const RECENT_SERVICE_COUNT = 12;
const TOP_SONGS = 15;

type ServiceRow = { id: string; service_date: string; title: string | null };

type SetlistLineRow = {
  service_id: string;
  position: number;
  custom_title_override: string | null;
  songs: { title: string } | { title: string }[] | null;
};

type TrendItemRow = {
  song_id: string;
  songs:
    | { title: string; subtitle: string | null }
    | { title: string; subtitle: string | null }[]
    | null;
};

function songTitleFromRow(row: TrendItemRow): string {
  const raw = row.songs;
  const meta = Array.isArray(raw) ? raw[0] : raw;
  const t = meta?.title?.trim();
  return t && t.length > 0 ? t : "Untitled song";
}

function lineDisplayTitle(row: SetlistLineRow): string {
  const o = row.custom_title_override?.trim();
  if (o) return o;
  const raw = row.songs;
  const meta = Array.isArray(raw) ? raw[0] : raw;
  const t = meta?.title?.trim();
  return t && t.length > 0 ? t : "Untitled song";
}

function ymd(date: Date) {
  return format(date, "yyyy-MM-dd");
}

const MAX_VISIBLE_SONG_ROWS = 3;

function bucketsForCounts(countsByIso: Record<string, number>): {
  empty: Date[];
  light: Date[];
  medium: Date[];
  heavy: Date[];
} {
  const empty: Date[] = [];
  const light: Date[] = [];
  const medium: Date[] = [];
  const heavy: Date[] = [];
  for (const [iso, n] of Object.entries(countsByIso)) {
    const d = new Date(iso + "T12:00:00");
    if (Number.isNaN(d.getTime())) continue;
    if (n < 1) empty.push(d);
    else if (n >= 10) heavy.push(d);
    else if (n >= 5) medium.push(d);
    else light.push(d);
  }
  return { empty, light, medium, heavy };
}

export default function CalendarTrends() {
  const navigate = useNavigate();
  const pickerLocale = enUS satisfies Partial<Locale>;

  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [loadingCalendar, setLoadingCalendar] = useState(true);
  const [songTitlesByIso, setSongTitlesByIso] = useState<Record<string, string[]>>({});
  const [errorCalendar, setErrorCalendar] = useState<string | null>(null);

  const [loadingTrends, setLoadingTrends] = useState(true);
  const [trendRows, setTrendRows] = useState<Array<{ songId: string; title: string; count: number }>>(
    [],
  );
  const [errorTrends, setErrorTrends] = useState<string | null>(null);

  const loadCalendar = useCallback(async (visibleMonth: Date) => {
    setLoadingCalendar(true);
    setErrorCalendar(null);
    const from = subDays(startOfMonth(visibleMonth), 7);
    const through = addDays(endOfMonth(visibleMonth), 7);

    const { data: svcData, error: svcErr } = await supabase
      .from("services")
      .select("id, service_date, title")
      .gte("service_date", ymd(from))
      .lte("service_date", ymd(through))
      .order("service_date", { ascending: true });

    if (svcErr) {
      setErrorCalendar(svcErr.message);
      setSongTitlesByIso({});
      setLoadingCalendar(false);
      return;
    }

    const services = (svcData as ServiceRow[]) ?? [];
    const ids = services.map((s) => s.id);

    if (ids.length === 0) {
      setSongTitlesByIso({});
      setLoadingCalendar(false);
      return;
    }

    const { data: itemData, error: itemsErr } = await supabase
      .from("setlist_items")
      .select("service_id, position, custom_title_override, songs (title)")
      .in("service_id", ids);

    if (itemsErr) {
      setErrorCalendar(itemsErr.message);
      setSongTitlesByIso({});
      setLoadingCalendar(false);
      return;
    }

    const linesByService = new Map<string, SetlistLineRow[]>();
    for (const row of (itemData as unknown as SetlistLineRow[]) ?? []) {
      if (!row?.service_id) continue;
      const list = linesByService.get(row.service_id);
      if (list) list.push(row);
      else linesByService.set(row.service_id, [row]);
    }
    for (const list of linesByService.values()) {
      list.sort((a, b) => a.position - b.position);
    }

    const titlesByIso: Record<string, string[]> = {};
    for (const s of services) {
      const lines = linesByService.get(s.id) ?? [];
      titlesByIso[s.service_date] = lines.map(lineDisplayTitle);
    }

    setSongTitlesByIso(titlesByIso);
    setLoadingCalendar(false);
  }, []);

  useEffect(() => {
    void loadCalendar(month);
  }, [loadCalendar, month]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoadingTrends(true);
      setErrorTrends(null);
      const { data: svcData, error: svcErr } = await supabase
        .from("services")
        .select("id")
        .order("service_date", { ascending: false })
        .limit(RECENT_SERVICE_COUNT);

      if (cancelled) return;

      if (svcErr) {
        setErrorTrends(svcErr.message);
        setTrendRows([]);
        setLoadingTrends(false);
        return;
      }

      const ids = ((svcData as { id: string }[]) ?? []).map((r) => r.id);
      if (ids.length === 0) {
        setTrendRows([]);
        setLoadingTrends(false);
        return;
      }

      const { data: trendData, error: trendErr } = await supabase
        .from("setlist_items")
        .select("song_id, songs (title, subtitle)")
        .in("service_id", ids);

      if (cancelled) return;

      if (trendErr) {
        setErrorTrends(trendErr.message);
        setTrendRows([]);
        setLoadingTrends(false);
        return;
      }

      const bySong = new Map<string, { title: string; count: number }>();
      for (const row of (trendData as unknown as TrendItemRow[]) ?? []) {
        if (!row?.song_id) continue;
        const title = songTitleFromRow(row);
        const cur = bySong.get(row.song_id);
        if (cur) cur.count += 1;
        else bySong.set(row.song_id, { title, count: 1 });
      }

      const sorted = [...bySong.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, TOP_SONGS)
        .map(([songId, v]) => ({ songId, title: v.title, count: v.count }));
      setTrendRows(sorted);
      setLoadingTrends(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const countsByIso = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [iso, titles] of Object.entries(songTitlesByIso)) {
      out[iso] = titles.length;
    }
    return out;
  }, [songTitlesByIso]);

  const buckets = useMemo(() => bucketsForCounts(countsByIso), [countsByIso]);

  type DayBtnProps = ComponentProps<typeof DayButton>;

  const renderDayButton = useCallback(
    (props: DayBtnProps) => {
      const iso = ymd(props.day.date);
      const titles = songTitlesByIso[iso];
      const n = titles?.length;
      let label = props["aria-label"];
      if (n !== undefined && n === 0) {
        label = `${format(props.day.date, "PPPP", { locale: pickerLocale })}, service recorded — no songs yet`;
      } else if (n !== undefined && n > 0) {
        const listed = titles.slice(0, 6).join("; ");
        const more = titles.length > 6 ? `; and ${titles.length - 6} more` : "";
        label = `${format(props.day.date, "PPPP", { locale: pickerLocale })}, ${n} songs: ${listed}${more}`;
      }
      const visible = titles?.slice(0, MAX_VISIBLE_SONG_ROWS) ?? [];
      const extra = titles && titles.length > MAX_VISIBLE_SONG_ROWS ? titles.length - MAX_VISIBLE_SONG_ROWS : 0;
      return (
        <CalendarDayButton {...props} locale={pickerLocale} aria-label={label}>
          <span className="day-num w-full shrink-0 text-center text-[0.8rem] font-semibold">{props.children}</span>
          {visible.length > 0 ? (
            <ul className="mt-1 w-full min-w-0 list-none space-y-0.5 text-left">
              {visible.map((t, i) => (
                <li key={`${iso}-${i}`}>
                  <span className="title-line block truncate" title={t}>
                    {t}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {extra > 0 ? (
            <span className="title-line mt-0.5 text-muted-foreground">+{extra} more</span>
          ) : null}
        </CalendarDayButton>
      );
    },
    [songTitlesByIso, pickerLocale],
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
        <Card className="@container/cardcal">
          <CardHeader>
            <CardTitle>Setlist calendar</CardTitle>
            <CardDescription>
              Recorded dates are highlighted — stronger fill means busier setlists. A muted outline means the date exists but has no songs yet. Song titles preview in each cell (tap any highlighted day for the full setlist).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {errorCalendar ? (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{errorCalendar}</AlertDescription>
              </Alert>
            ) : null}
            {loadingCalendar ? (
              <Skeleton className="min-h-[24rem] w-full rounded-xl" />
            ) : (
              <Calendar
                className={cn(
                  "mx-auto w-full max-w-none",
                  "[--cell-size:clamp(5rem,calc((min(100cqw,120rem)-2.5rem)_/_7_-_0.35rem),9.75rem)]",
                )}
                locale={pickerLocale}
                month={month}
                onMonthChange={(m) => setMonth(startOfMonth(m))}
                onDayClick={(date) => {
                  const iso = ymd(date);
                  if (iso in songTitlesByIso) {
                    void navigate(`/service/${iso}`);
                  }
                }}
                modifiers={{
                  service_empty: buckets.empty,
                  setlist_light: buckets.light,
                  setlist_medium: buckets.medium,
                  setlist_heavy: buckets.heavy,
                }}
                modifiersClassNames={{
                  service_empty: "bg-muted/40 ring-1 ring-border/70 data-[outside]:bg-muted/25",
                  setlist_light: "bg-primary/15 data-[outside]:bg-primary/[0.08] [&_button]:bg-primary/[0.06]",
                  setlist_medium: "bg-primary/25 data-[outside]:bg-primary/[0.12] [&_button]:bg-primary/10",
                  setlist_heavy: "bg-primary/35 data-[outside]:bg-primary/[0.16] [&_button]:bg-primary/15",
                }}
                components={{
                  DayButton: renderDayButton,
                }}
                buttonVariant="outline"
              />
            )}
          </CardContent>
        </Card>

        <Card className="h-fit lg:sticky lg:top-4">
          <CardHeader>
            <CardTitle>Recent rotation</CardTitle>
            <CardDescription>
              Songs by line appearances in the last {RECENT_SERVICE_COUNT} recorded services (same song counted twice if it appeared twice).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {errorTrends ? (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{errorTrends}</AlertDescription>
              </Alert>
            ) : null}
            {loadingTrends ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[90%]" />
                <Skeleton className="h-4 w-[80%]" />
              </div>
            ) : trendRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No setlist lines in recent services.</p>
            ) : (
              <ol className="list-decimal space-y-2 pl-4 text-sm">
                {trendRows.map((r) => (
                  <li key={r.songId} className="marker:text-muted-foreground">
                    <span className="font-medium">{r.title}</span>
                    <span className="text-muted-foreground"> — {r.count}×</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        For all-time counts see{" "}
        <Link className="underline underline-offset-2 hover:text-foreground" to="/stats">
          Song counts
        </Link>
        .
      </p>
    </div>
  );
}
