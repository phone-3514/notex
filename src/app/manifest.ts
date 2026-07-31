import type { MetadataRoute } from "next";

// Next.js serves this at /manifest.webmanifest and auto-injects the
// <link rel="manifest"> tag — no manual wiring needed in layout.tsx.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Notex",
    short_name: "Notex",
    description: "Fast local-first note taking for university math.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#171717",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
