import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Maná · Pães & Mais",
    short_name: "Maná",
    description:
      "Gestão da Maná — receitas, preços, pedidos e finanças da cozinha artesanal",
    start_url: "/",
    display: "standalone",
    background_color: "#efe9da",
    theme_color: "#3a4720",
    orientation: "portrait",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
