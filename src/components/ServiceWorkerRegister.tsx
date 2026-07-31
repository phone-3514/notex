"use client";

import { useEffect } from "react";

// Registers the offline/app-shell service worker (public/sw.js). A no-op
// component (renders nothing) — exists purely for the registration effect,
// kept separate from page.tsx so it's easy to find/remove independently.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    // Dev-mode bundle filenames are stable (not content-hashed), so a
    // cache-first service worker would keep serving a stale chunk across
    // rebuilds and silently defeat HMR. Only register in production, where
    // build output is hashed and this can't happen.
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Offline support is a progressive enhancement — a failed
      // registration (e.g. unsupported browser, dev-mode quirks) should
      // never block the editor itself.
    });
  }, []);

  return null;
}
