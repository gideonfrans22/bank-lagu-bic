import type { Session, User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type AuthState =
  | { status: "loading"; session: null; user: null }
  | { status: "signed_out"; session: null; user: null }
  | { status: "signed_in"; session: Session; user: User };

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    status: "loading",
    session: null,
    user: null,
  });

  useEffect(() => {
    let cancelled = false;

    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error(error);
          setState({ status: "signed_out", session: null, user: null });
          return;
        }
        const s = data.session;
        if (s?.user) {
          setState({ status: "signed_in", session: s, user: s.user });
        } else {
          setState({ status: "signed_out", session: null, user: null });
        }
      })
      .catch((err: unknown) => {
        console.error(err);
        if (!cancelled) {
          setState({ status: "signed_out", session: null, user: null });
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setState({ status: "signed_in", session, user: session.user });
      } else {
        setState({ status: "signed_out", session: null, user: null });
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}
