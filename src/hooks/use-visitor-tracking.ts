import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const NO_TRACK_KEY = "nexus-no-track";

export const useVisitorTracking = () => {
  const loc = useLocation();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (lastPath.current === loc.pathname) return;
    if (localStorage.getItem(NO_TRACK_KEY) === "1") return;
    lastPath.current = loc.pathname;

    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        await fetch(`${SUPABASE_URL}/functions/v1/log-visit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: ANON_KEY,
          },
          body: JSON.stringify({
            path: loc.pathname,
            referrer: document.referrer || null,
            user_id: user?.id || null,
          }),
          keepalive: true,
        });
      } catch {
        // silent
      }
    })();
  }, [loc.pathname]);
};
