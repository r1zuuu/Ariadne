import type { Metadata } from "next";
import { MotionProvider } from "@/components/motion";
import { ToastProvider } from "@/components/toast";
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
        {/* Toasts inside the locale provider, because their text is translated.
            Motion wraps everything: it is the lazy feature loader, so it has to
            be above every m component in the tree, and it costs nothing until
            one mounts. */}
        <LocaleProvider>
          <MotionProvider>
            <ToastProvider>{children}</ToastProvider>
          </MotionProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
