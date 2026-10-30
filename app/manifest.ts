import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GAUR LINKS",
    short_name: "GAUR LINKS",
    description:
      "GAUR LINKS creates tracked redirect links, UTM campaign URLs, QR codes, and shareable smart links.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f1ea",
    theme_color: "#202522",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/icon.svg",
        sizes: "180x180",
        type: "image/svg+xml",
      },
    ],
  }
}
