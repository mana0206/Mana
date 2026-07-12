import type { Metadata, Viewport } from "next";
import {
  Archivo,
  DM_Serif_Display,
  Petit_Formal_Script,
} from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});

const dmSerif = DM_Serif_Display({
  variable: "--font-dm-serif",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

const petitScript = Petit_Formal_Script({
  variable: "--font-petit-script",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Maná",
  description:
    "Maná · Pães & Mais — receitas, preços, pedidos e finanças da cozinha artesanal",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Maná",
  },
};

export const viewport: Viewport = {
  themeColor: "#3a4720",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${archivo.variable} ${dmSerif.variable} ${petitScript.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
