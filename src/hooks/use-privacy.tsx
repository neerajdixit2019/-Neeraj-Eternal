import { useState, useEffect, useCallback } from "react";

const KEY = "mqs-privacy-mode";

export function usePrivacyMode() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    try {
      setEnabled(localStorage.getItem(KEY) === "1");
    } catch { /* ignore */ }
  }, []);

  const toggle = useCallback(() => {
    setEnabled(prev => {
      const next = !prev;
      try { localStorage.setItem(KEY, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  }, []);

  return { enabled, toggle };
}
