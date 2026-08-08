"use client";

import type { ReactNode } from "react";

// The persistent frame for the six in-app screens. Next keeps a layout
// mounted across navigations between its children, which is what lets the
// shell (and its animations) survive a screen change. Starts as a
// pass-through; AppShell moves in here once the provider exists.
export default function ShellLayout({ children }: { children: ReactNode }) {
  return children;
}
