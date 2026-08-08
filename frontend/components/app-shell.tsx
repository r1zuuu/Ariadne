"use client";

import { m } from "motion/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useApp } from "@/components/app-provider";
import { enterTransition } from "@/components/motion";
import { TitleBar } from "@/components/title-bar";
import { clearToken, type Project } from "@/lib/api";
import { resetTour } from "@/lib/first-run";

// The frame every screen inside the app sits in: title bar, a column on the
// left, content on the right.
//
// The column answers "where am I" and "which project is this about" at all
// times. Data comes from AppProvider in the (shell) layout, so navigating
// between screens neither refetches it nor remounts this frame.

export type Section = "home" | "project" | "assistant" | "database" | "pending" | "settings";

// `label` is not always the section name: "database" is what the screen has
// always been called in the code and the URL, but "Dodaj kontekst" told a
// non-technical reader nothing, so the column says "Dodaj do pamięci" instead.
type NavLink = {
  section: Section;
  label: string;
  href: string;
  needsProject: boolean;
  icon: ReactNode;
};

// Two groups, because the column mixes two kinds of place: where the work on
// this project happens, and where the account is looked after. Six equal rows
// answered "which screens exist", not "where should I go".
const WORK_LINKS: NavLink[] = [
  { section: "home", label: "home", href: "/home", needsProject: false, icon: <IconHome /> },
  {
    section: "project",
    label: "project",
    href: "/project",
    needsProject: true,
    icon: <IconProject />,
  },
  {
    section: "assistant",
    label: "assistant",
    href: "/assistant",
    needsProject: true,
    icon: <IconAsk />,
  },
  {
    section: "database",
    label: "memory",
    href: "/database",
    needsProject: true,
    icon: <IconAdd />,
  },
];

const ACCOUNT_LINKS: NavLink[] = [
  {
    section: "pending",
    label: "pending",
    href: "/pending",
    needsProject: false,
    icon: <IconQueue />,
  },
  {
    section: "settings",
    label: "settings",
    href: "/settings",
    needsProject: false,
    icon: <IconSettings />,
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations("nav");
  const router = useRouter();
  const pathname = usePathname();
  const { projects, activeProject, pendingCount, server } = useApp();

  const active = activeProject;
  const waiting = pendingCount;

  const signOut = () => {
    clearToken();
    // Not router.push: the token is gone and nothing behind this point should
    // stay mounted holding data fetched with it.
    window.location.href = "/";
  };

  return (
    <div className="flex h-full flex-col">
      <TitleBar project={active?.name} server={server} />

      <div className="flex min-h-0 flex-1">
        {/* Icons only below 1024px, which covers the 880px window minimum, and
            labelled above it. The window opens at 1100px, so the labelled form
            is what anyone actually sees. */}
        <nav className="flex w-[68px] shrink-0 flex-col gap-2 border-r border-hairline bg-plaster-sunk p-3 lg:w-[236px] lg:p-4">
          <ProjectSwitcher projects={projects ?? []} active={active} />

          <NavList
            links={WORK_LINKS}
            pathname={pathname}
            hasProject={!!active}
            waiting={waiting}
            className="pt-2"
          />

          {/* The account group sits under its own hairline: the queue and the
              settings are about the whole archive, not the open project. */}
          <NavList
            links={ACCOUNT_LINKS}
            pathname={pathname}
            hasProject={!!active}
            waiting={waiting}
            className="mt-2 border-t border-hairline pt-3"
          />

          <div className="mt-auto flex flex-col gap-1">
            {/* Next to sign out because it is the same kind of thing: a door out
                of the work, not part of it. resetTour clears the per-screen
                notes too, so asking to be shown around brings all of it back. */}
            <button
              type="button"
              onClick={() => {
                resetTour();
                router.push("/onboarding-tour");
              }}
              title={t("tour")}
              className="flex items-center gap-3 rounded-control px-4 py-[10px] text-small text-ink-3 transition-colors duration-state hover:bg-surface/70 hover:text-ink"
            >
              <IconTour />
              <span className="hidden lg:inline">{t("tour")}</span>
            </button>

            <button
              type="button"
              onClick={signOut}
              title={t("signOut")}
              className="flex items-center gap-3 rounded-control px-4 py-[10px] text-small text-ink-3 transition-colors duration-state hover:bg-surface/70 hover:text-iron"
            >
              <IconSignOut />
              <span className="hidden lg:inline">{t("signOut")}</span>
            </button>
          </div>
        </nav>

        <main className="min-h-0 flex-1 overflow-y-auto px-6 py-7 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function NavList({
  links,
  pathname,
  hasProject,
  waiting,
  className = "",
}: {
  links: NavLink[];
  pathname: string;
  hasProject: boolean;
  waiting: number;
  className?: string;
}) {
  const t = useTranslations("nav");

  return (
    <ul className={`flex flex-col gap-1 ${className}`}>
      {links.map(({ section, label, href, needsProject, icon }) => {
        const blocked = needsProject && !hasProject;
        const current = pathname === href;
        const shared =
          "flex items-center gap-3 rounded-control px-4 py-[10px] text-small transition-colors duration-state";

        if (blocked) {
          // Present but not clickable, and it says why on hover rather than
          // vanishing: a menu that changes length as you use the app is harder
          // to learn than one with a dimmed row.
          return (
            <li key={section}>
              <span
                title={t("needsProject")}
                aria-disabled="true"
                className={`${shared} cursor-not-allowed text-ink-3/50`}
              >
                <span className="shrink-0">{icon}</span>
                <span className="hidden lg:inline">{t(label)}</span>
              </span>
            </li>
          );
        }

        return (
          <li key={section}>
            <Link
              href={href}
              title={t(label)}
              aria-current={current ? "page" : undefined}
              className={`relative ${shared} ${
                current ? "font-medium text-ink" : "text-ink-2 hover:bg-surface/70 hover:text-ink"
              }`}
            >
              {/* One marker for the whole column, so moving between screens
                  slides it instead of blinking it out here and in there. The
                  taut edge on its left is the thread marking where you stand;
                  it is the only saturated colour in the frame. Behind the row
                  rather than around it, because the label must not move. */}
              {current ? (
                <m.span
                  layoutId="nav-marker"
                  transition={enterTransition}
                  aria-hidden="true"
                  className="absolute inset-0 overflow-hidden rounded-control bg-surface shadow-card"
                >
                  <span className="absolute bottom-[6px] left-0 top-[6px] w-[2px] bg-thread" />
                </m.span>
              ) : null}
              <span className="relative shrink-0">{icon}</span>
              <span className="relative hidden lg:inline">{t(label)}</span>
              {section === "pending" && waiting ? (
                <span className="relative ml-auto hidden rounded-label bg-ochre/15 px-[8px] py-[2px] text-data tabular text-ochre lg:inline">
                  {waiting}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// A real switcher, not a form field: the open project is named in full with its
// stage underneath, and the list only appears when asked for. Built on <details>
// so that closing on Escape and on outside click come from the browser.
function ProjectSwitcher({ projects, active }: { projects: Project[]; active: Project | null }) {
  const t = useTranslations("nav");
  const tProject = useTranslations("project");
  const { setActiveProject } = useApp();

  if (!active) {
    return (
      <div className="hidden rounded-control border border-dashed border-edge/40 px-4 py-[10px] text-small text-ink-3 lg:block">
        {t("noProject")}
      </div>
    );
  }

  // One project is not a choice, so it reads as a heading instead of a control.
  if (projects.length < 2) {
    return (
      <div className="rounded-control px-4 py-3 lg:bg-surface lg:shadow-card">
        <p className="truncate text-small font-medium text-ink max-lg:hidden">{active.name}</p>
        <p className="truncate text-data text-ink-3 max-lg:hidden">
          {tProject(`etap.${active.etap}`)}
        </p>
        <p className="grid h-[34px] w-full place-items-center rounded-control bg-surface text-data font-medium text-thread lg:hidden">
          {active.name.slice(0, 2).toUpperCase()}
        </p>
      </div>
    );
  }

  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-control px-4 py-3 marker:hidden lg:bg-surface lg:shadow-card">
        <span className="min-w-0 flex-1 max-lg:hidden">
          <span className="block truncate text-left text-small font-medium text-ink">
            {active.name}
          </span>
          <span className="block truncate text-left text-data text-ink-3">
            {tProject(`etap.${active.etap}`)}
          </span>
        </span>
        <span className="grid h-[34px] w-full place-items-center rounded-control bg-surface text-data font-medium text-thread lg:hidden">
          {active.name.slice(0, 2).toUpperCase()}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
          className="shrink-0 text-ink-3 transition-transform duration-state group-open:rotate-180 max-lg:hidden"
        >
          <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </summary>

      <ul className="absolute left-0 right-0 z-20 mt-1 max-h-[320px] overflow-y-auto rounded-card border border-hairline bg-surface p-1 shadow-lifted max-lg:left-3 max-lg:w-[220px]">
        {projects.map((project) => (
          <li key={project.id}>
            <button
              type="button"
              onClick={(event) => {
                setActiveProject(project.id);
                // <details> only closes itself on outside click; picking a
                // project is a decision, so the list folds away with it.
                event.currentTarget.closest("details")?.removeAttribute("open");
              }}
              className={`flex w-full items-baseline justify-between gap-3 rounded-control px-4 py-3 text-left text-small transition-colors duration-state hover:bg-plaster-sunk ${
                project.id === active.id ? "text-ink" : "text-ink-2"
              }`}
            >
              <span className="min-w-0 truncate">{project.name}</span>
              {project.pendingCount ? (
                <span className="shrink-0 text-data tabular text-ochre">
                  {project.pendingCount}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}

// Line icons at 18px, one weight, no fills. They exist to make the column
// scannable at the narrow width where the labels are gone, not for decoration.
const stroke = {
  width: 18,
  height: 18,
  viewBox: "0 0 18 18",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function IconHome() {
  return (
    <svg {...stroke}>
      <path d="M2.5 7.2 9 2.5l6.5 4.7V15a.5.5 0 0 1-.5.5h-4v-5H7v5H3a.5.5 0 0 1-.5-.5Z" />
    </svg>
  );
}

function IconProject() {
  return (
    <svg {...stroke}>
      <rect x="2.5" y="3.5" width="13" height="11" rx="1.5" />
      <path d="M2.5 7h13M6 3.5v3.5" />
    </svg>
  );
}

function IconAsk() {
  return (
    <svg {...stroke}>
      <path d="M15.5 9c0 3.1-2.9 5.6-6.5 5.6-.8 0-1.6-.1-2.3-.4L2.5 15.5l1.3-3.4A5.3 5.3 0 0 1 2.5 9C2.5 5.9 5.4 3.4 9 3.4s6.5 2.5 6.5 5.6Z" />
    </svg>
  );
}

function IconAdd() {
  return (
    <svg {...stroke}>
      <path d="M9 3.5v11M3.5 9h11" />
    </svg>
  );
}

function IconQueue() {
  return (
    <svg {...stroke}>
      <path d="M3 5h12M3 9h12M3 13h7" />
    </svg>
  );
}

// A dial rather than the usual cogwheel: the settings here are a handful of
// switches, and a gear promises machinery that is not behind it.
function IconSettings() {
  return (
    <svg {...stroke}>
      <path d="M2.5 6h9M14 6h1.5M2.5 12h4M9 12h6.5" />
      <circle cx="12.5" cy="6" r="1.6" />
      <circle cx="7.5" cy="12" r="1.6" />
    </svg>
  );
}

// Two points and the thread between them, which is the product in one glyph.
function IconTour() {
  return (
    <svg {...stroke}>
      <circle cx="4" cy="4" r="1.6" />
      <circle cx="14" cy="14" r="1.6" />
      <path d="M4 5.6C4 10 14 8 14 12.4" />
    </svg>
  );
}

function IconSignOut() {
  return (
    <svg {...stroke}>
      <path d="M11 12.5v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M7.5 9h8m0 0-2.5-2.5M15.5 9 13 11.5" />
    </svg>
  );
}
