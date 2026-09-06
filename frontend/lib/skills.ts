// Agent skills are directories on this machine, so this is the one thing in the
// app that does not go through lib/api.ts. Nothing here touches the network:
// the calls land in src-tauri/src/skills.rs and read the disk the window runs on.

import { invoke } from "@tauri-apps/api/core";

export { inApp } from "@/lib/desktop";

export type RootId = "agents" | "claude" | "codex";

export type RootInfo = {
  id: RootId;
  path: string;
  /** False when that tool is not installed here. */
  exists: boolean;
};

export type SkillEntry = {
  root: RootId;
  name: string;
  path: string;
  /** Where it points, when it is a link into another root rather than the real
   *  directory. */
  link: string | null;
  /** Whether it holds a SKILL.md. Without one it is somebody's stray folder. */
  manifest: boolean;
};

export type Scan = { roots: RootInfo[]; entries: SkillEntry[] };

export type LinkReport = {
  created: { root: RootId; name: string }[];
  /** Names held by a different real directory in more than one root. */
  conflicts: string[];
  failed: { root: RootId; name: string; reason: "name" | "refused" }[];
};

export const scanSkills = () => invoke<Scan>("skills_scan");
export const linkAllSkills = () => invoke<LinkReport>("skills_link_all");

export type RootState = RootInfo & {
  /** Skills this tool can currently see. */
  seen: number;
};

export type SkillsState = {
  /** Distinct skills across every root. */
  total: number;
  roots: RootState[];
  /** Links whose target is gone. Reported, never repaired: repairing one means
   *  deleting it, and nothing in this feature deletes. */
  broken: number;
  /** How many links pressing the button would open. Zero means every tool
   *  already sees everything. */
  missing: number;
};

/**
 * The scan turned into the four numbers the settings section shows.
 *
 * A skill is counted by name, once, however many roots hold a door into it. A
 * link and the real directory it points at are the same skill, which is the
 * whole reason the count is not `entries.length`.
 */
export function summarise(scan: Scan): SkillsState {
  const named = scan.entries.filter((entry) => entry.manifest);
  const all = new Set(named.map((entry) => entry.name));
  const live = scan.roots.filter((root) => root.exists);

  const roots: RootState[] = scan.roots.map((root) => ({
    ...root,
    seen: named.filter((entry) => entry.root === root.id).length,
  }));

  return {
    total: all.size,
    roots,
    broken: scan.entries.filter((entry) => entry.link !== null && !entry.manifest).length,
    // Only roots that exist can be filled: a missing one means the tool is not
    // installed, and creating its directory would plant a folder for a program
    // that is not here.
    missing: live.reduce(
      (sum, root) => sum + (all.size - roots.find((r) => r.id === root.id)!.seen),
      0,
    ),
  };
}
