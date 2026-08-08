"use client";

import type { ReactNode } from "react";
import { AppProvider } from "@/components/app-provider";

// The persistent frame for the six in-app screens. Next keeps a layout
// mounted across navigations between its children, which is what lets the
// shell (and its animations) survive a screen change. The provider owns the
// data every screen shares; AppShell moves in here next.
export default function ShellLayout({ children }: { children: ReactNode }) {
  return <AppProvider>{children}</AppProvider>;
}
