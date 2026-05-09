import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import type { Service } from "@/types/database";
import { supabase } from "@/lib/supabase";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

export default function Dashboard() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error: reqErr } = await supabase
        .from("services")
        .select("*")
        .order("service_date", { ascending: false })
        .limit(50);
      if (cancelled) return;
      if (reqErr) {
        setError(reqErr.message);
      } else {
        setServices((data as Service[]) ?? []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Sundays</CardTitle>
        <CardDescription>
          Record what was sung each week so you can revisit setlists and see how often each song appears.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Link className={cn(buttonVariants({ size: "default" }))} to={`/service/${isoToday()}`}>
            Edit today’s date…
          </Link>
          <Link className={cn(buttonVariants({ variant: "outline" }))} to="/service/new">
            Pick another Sunday
          </Link>
        </div>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-[62%]" />
            <Skeleton className="h-4 w-[40%]" />
          </div>
        ) : null}
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {!loading && !error && services.length === 0 ? (
          <p className="text-sm text-muted-foreground">No services yet — start with “Pick another Sunday”.</p>
        ) : null}
        <ul className="space-y-0 divide-y divide-border rounded-lg border bg-card px-3 py-0">
          {!loading &&
            !error &&
            services.map((s) => (
              <li key={s.id}>
                <Link
                  className="-mx-3 block px-3 py-2.5 text-sm transition-colors hover:bg-muted/50"
                  to={`/service/${s.service_date}`}
                >
                  <strong className="font-medium">{s.service_date}</strong>
                  {s.title ? <span className="text-muted-foreground"> — {s.title}</span> : null}
                </Link>
              </li>
            ))}
        </ul>
        {!loading && !error && services.length > 0 ? <Separator /> : null}
      </CardContent>
    </Card>
  );
}
