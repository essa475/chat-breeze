import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function usePresencePulse(userId?: string) {
  useEffect(() => {
    if (!userId) return;
    const touch = () => void supabase.rpc("touch_presence");
    touch();
    const timer = window.setInterval(touch, 30_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") touch();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      touch();
    };
  }, [userId]);
}
