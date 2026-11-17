import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Here Happened",
    short_name: "Here Happened",
    description: "The history of any place on Earth, quoted from real sources.",
    start_url: "/",
    display: "standalone",
    background_color: "#F2F1EC",
    theme_color: "#F2F1EC",
    icons: [
      { src: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
