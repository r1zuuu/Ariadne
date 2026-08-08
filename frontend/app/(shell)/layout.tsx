"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppProvider } from "@/components/app-provider";
import { AppShell } from "@/components/app-shell";
import { FadeIn } from "@/components/motion";

// The persistent frame for the six in-app screens. Next keeps a layout
// mounted across navigations between its children, so the shell renders once
// per hard load: the nav marker glides instead of blinking, and shared data
// survives a screen change. Keying FadeIn on the pathname remounts only the
// page content, which gives every screen the same quiet entrance.
export default function ShellLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <AppProvider>
      <AppShell>
        <FadeIn key={pathname}>{children}</FadeIn>
      </AppShell>
    </AppProvider>
  );
}
