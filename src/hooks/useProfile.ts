import { useEffect, useState } from "react";
import type { Profile } from "@/types/database";
import { supabase } from "@/lib/supabase";

export function useProfile(userId: string | undefined): Profile | null {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    void supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error) return;
        setProfile(data as Profile);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return profile;
}
