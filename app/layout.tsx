import "./globals.css";
import type { Metadata } from "next";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = {
  title: "Antea Fitness Dashboard",
  description: "Gamificirana motivacija 💖",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="hr">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#2563eb" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className="bg-gray-100 text-gray-900 min-h-screen flex flex-col">
        <NavBar />
        <div className="flex-1">
          {children}
        </div>
      </body>
    </html>
  );
}
