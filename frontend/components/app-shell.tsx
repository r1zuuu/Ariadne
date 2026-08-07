"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { TitleBar, type ServerState } from "@/components/title-bar";
import { clearToken, getPending, listProjects, readToken, type Project } from "@/lib/api";

// The frame every screen inside the app sits in: title bar, a column on the
// left, content on the right. Navigation variant 2c from the spec, minus the
// collapsing, which is a comfort and not a feature.
//
// The column is the only place a project is chosen. Everything under the
// switcher is about the open project, so a window with no projects shows only
// the entries that still mean something without one.

const ACTIVE_PROJECT_KEY = "ariadne.activeProject";

export type Section = "home" | "project" | "assistant" | "database" | "pending";

const LINKS: { section: Section; href: string; needsProject: boolean }[] = [
  { section: "home", href: "/home", needsProject: false },
  { section: "project", href: "/project", needsProject: true },
  { section: "assistant", href: "/assistant", needsProject: true },
  { section: "database", href: "/database", needsProject: true },
  { section: "pending", href: "/pending", needsProject: false },
];

/** Read by every screen that needs to know which project it is showing. */
export function readActiveProject(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(ACTIVE_PROJECT_KEY);
}

/**
 * Switch project from anywhere. The reload is deliberate: every screen reads
 * the active project once on mount, and this is the single event that
 * invalidates all of them at once, including the title bar and the column.
 */
export function pickProject(id: string) {
  localStorage.setItem(ACTIVE_PROJECT_KEY, id);
  window.location.reload();
}

export function AppShell({
  children,
  server = "up",
  banner,
}: {
  children: ReactNode;
  server?: ServerState;
  banner?: ReactNode;
}) {
  const t = useTranslations("nav");
  const router = useRouter();
  const pathname = usePathname();

  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(0);

  useEffect(() => {
    if (!readToken()) {
      router.replace("/");
      return;
    }
    void listProjects()
      .then((rows) => {
        setProjects(rows);
        const remembered = readActiveProject();
        setActiveId(rows.some((p) => p.id === remembered) ? remembered : (rows[0]?.id ?? null));
      })
      .catch(() => {});
    // The counter is the one number on screen that is about the whole account
    // rather than the open project, so it is fetched here and not per screen.
    void getPending()
      .then((feed) => setWaiting(feed.pendingActions.length + feed.nodesToReview.length))
      .catch(() => {});
  }, [router]);

  const active = projects.find((p) => p.id === activeId) ?? null;

  const signOut = () => {
    clearToken();
    // Not router.push: the token is gone and nothing behind this point should
    // stay mounted holding data fetched with it.
    window.location.href = "/";
  };

  return (
    <div className="flex h-full flex-col">
      <TitleBar project={active?.name} server={server} />
      {banner}

      <div className="flex min-h-0 flex-1">
        <nav className="flex w-[200px] shrink-0 flex-col gap-6 border-r border-hairline bg-plaster-sunk px-4 py-5">
          {projects.length > 1 ? (
            <label className="block">
              <span className="sr-only">{t("project")}</span>
              <select
                value={activeId ?? ""}
                onChange={(e) => pickProject(e.target.value)}
                className="w-full rounded-control border border-edge bg-plaster-raised px-3 py-2 text-small text-ink"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <ul className="flex flex-col gap-1">
            {LINKS.map(({ section, href, needsProject }) => {
              const blocked = needsProject && !activeId;
              const current = pathname === href;
              return (
                <li key={section}>
                  {blocked ? (
                    // Present but not clickable, and it says why on hover rather
                    // than vanishing: a menu that changes length as you use the
                    // app is harder to learn than one with a dimmed row.
                    <span
                      title={t("needsProject")}
                      className="block cursor-not-allowed px-3 py-2 text-small text-ink-3/60"
                    >
                      {t(section)}
                    </span>
                  ) : (
                    <Link
                      href={href}
                      aria-current={current ? "page" : undefined}
                      className={`flex items-center justify-between px-3 py-2 text-small transition-colors duration-state ${
                        current
                          ? "border-l-2 border-blue bg-plaster pl-[10px] text-ink"
                          : "border-l-2 border-transparent pl-[10px] text-ink-2 hover:text-ink"
                      }`}
                    >
                      {t(section)}
                      {section === "pending" && waiting ? (
                        <span className="font-data text-data tabular text-ochre">{waiting}</span>
                      ) : null}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>

          <button
            type="button"
            onClick={signOut}
            className="mt-auto px-3 py-2 text-left text-small text-ink-2 transition-colors duration-state hover:text-iron"
          >
            {t("signOut")}
          </button>
        </nav>

        <main className="min-h-0 flex-1 overflow-y-auto px-8 py-9">{children}</main>
      </div>
    </div>
  );
}
