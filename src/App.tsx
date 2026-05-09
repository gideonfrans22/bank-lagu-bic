import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import CalendarTrends from "@/pages/CalendarTrends";
import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/Login";
import NewService from "@/pages/NewService";
import ServiceEdit from "@/pages/ServiceEdit";
import SongStats from "@/pages/SongStats";
import { supabase } from "@/lib/supabase";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

function Header({
  signedIn,
  displayName,
  onSignOut,
}: {
  signedIn: boolean;
  displayName?: string | null;
  onSignOut: () => void;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-center gap-3 pb-4">
      <h1 className="min-w-[8rem] flex-1 text-xl font-semibold tracking-tight">Bank Lagu</h1>
      {signedIn ? (
        <>
          <nav className="flex flex-wrap items-center gap-1">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                cn(buttonVariants({ variant: isActive ? "secondary" : "ghost", size: "sm" }))
              }
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/calendar"
              className={({ isActive }) =>
                cn(buttonVariants({ variant: isActive ? "secondary" : "ghost", size: "sm" }))
              }
            >
              Calendar
            </NavLink>
            <NavLink
              to="/stats"
              className={({ isActive }) =>
                cn(buttonVariants({ variant: isActive ? "secondary" : "ghost", size: "sm" }))
              }
            >
              Song counts
            </NavLink>
            <NavLink
              to="/service/new"
              className={({ isActive }) =>
                cn(buttonVariants({ variant: isActive ? "secondary" : "ghost", size: "sm" }))
              }
            >
              New Sunday
            </NavLink>
          </nav>
          <Separator orientation="vertical" className="hidden h-6 sm:block" />
          <span className="text-sm text-muted-foreground">{displayName ?? "Signed in"}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void onSignOut()}>
            Sign out
          </Button>
        </>
      ) : (
        <NavLink
          to="/login"
          className={({ isActive }) =>
            cn(buttonVariants({ variant: isActive ? "secondary" : "default", size: "sm" }))
          }
        >
          Sign in
        </NavLink>
      )}
    </header>
  );
}

export default function App() {
  const location = useLocation();
  const auth = useAuth();
  const profile = useProfile(auth.status === "signed_in" ? auth.user.id : undefined);
  /* Default to contributor until profile loads — RLS still enforces viewer on the server. */
  const canEdit = (profile?.role ?? "contributor") !== "viewer";

  async function onSignOut() {
    await supabase.auth.signOut();
  }

  if (auth.status === "loading") {
    return (
      <div className="mx-auto w-full max-w-3xl px-5 py-5">
        <p className="text-sm text-muted-foreground">Loading session…</p>
      </div>
    );
  }

  const signedIn = auth.status === "signed_in";
  const wideCalendar = signedIn && location.pathname === "/calendar";

  return (
    <div
      className={cn(
        "mx-auto w-full px-5 py-5",
        wideCalendar ? "max-w-5xl xl:max-w-6xl" : "max-w-3xl",
      )}
    >
      <Header signedIn={signedIn} displayName={profile?.display_name} onSignOut={onSignOut} />
      <Routes>
        <Route path="/login" element={signedIn ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/" element={signedIn ? <Dashboard /> : <Navigate to="/login" replace />} />
        <Route
          path="/calendar"
          element={signedIn ? <CalendarTrends /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/stats"
          element={signedIn ? <SongStats canEdit={!!canEdit} /> : <Navigate to="/login" replace />}
        />
        <Route path="/service/new" element={signedIn ? <NewService /> : <Navigate to="/login" replace />} />
        <Route
          path="/service/:serviceDate"
          element={signedIn ? <ServiceEdit canEdit={!!canEdit} /> : <Navigate to="/login" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
