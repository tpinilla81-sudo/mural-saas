import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import SWRegister from "@/components/SWRegister";

export const metadata: Metadata = {
  title: "MURAL",
  description: "Gestión de turnos y calendarios",
  manifest: "/manifest.webmanifest",
  applicationName: "MURAL",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MURAL",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b1120",
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="antialiased">
        {children}
        <Toaster />
        <SWRegister />
      </body>
    </html>
  );
}
