import type { Metadata } from "next";
import { LocaleProvider } from "./locale-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ariadne",
  description: "Pamiec miedzy sesjami",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // lang is corrected on the first client frame by LocaleProvider.
    <html lang="pl" suppressHydrationWarning>
      <body className="h-screen overflow-hidden bg-plaster text-ink antialiased">
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
