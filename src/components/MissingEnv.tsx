import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function MissingEnv() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 pt-8">
      <Card>
        <CardHeader>
          <CardTitle>Supabase env not set</CardTitle>
          <CardDescription>
            Copy <code className="rounded bg-muted px-1 py-0.5 text-sm">.env.example</code> to{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-sm">.env</code> in the project root and set
            both:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <ul className="list-inside list-disc space-y-2">
            <li>
              <code className="rounded bg-muted px-1 py-0.5">VITE_SUPABASE_URL</code> — Project URL from
              Supabase → Settings → API
            </li>
            <li>
              <code className="rounded bg-muted px-1 py-0.5">VITE_SUPABASE_ANON_KEY</code> —{" "}
              <code className="rounded bg-muted px-1 py-0.5">anon</code>{" "}
              <code className="rounded bg-muted px-1 py-0.5">public</code> key
            </li>
          </ul>
          <p className="text-muted-foreground">
            Restart <code className="rounded bg-muted px-1 py-0.5">npm run dev</code> after saving{" "}
            <code className="rounded bg-muted px-1 py-0.5">.env</code>; Vite only reads env at startup.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
