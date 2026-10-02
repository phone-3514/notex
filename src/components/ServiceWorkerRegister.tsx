"use client";

import { useEffect } from "react";

// Registers the offline/app-shell service worker (public/sw.js). A no-op
// component (renders nothing) — exists purely for the registration effect,
// kept separate from page.tsx so it's easy to find/remove independently.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Dev-mode bundle filenames are stable (not content-hashed), so a
    // cache-first service worker would keep serving a stale chunk across
    // rebuilds and silently defeat HMR. Only register in production, where
    // build output is hashed and this can't happen — and in development,
    // actively remove any worker (and its caches) a previous production run
    // on this same origin (localhost:3000) left registered: service workers
    // outlive the server that installed them, so merely not registering a
    // new one still leaves the old one serving stale JS/CSS from its cache.
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .then(() => caches.keys())
        .then((keys) => Promise.all(keys.filter((k) => k.startsWith("notex-shell-")).map((k) => caches.delete(k))))
        .catch(() => {
          // Best-effort cleanup; never block the editor.
        });
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Offline support is a progressive enhancement — a failed
      // registration (e.g. unsupported browser, dev-mode quirks) should
      // never block the editor itself.
    });
  }, []);

  return null;
}
