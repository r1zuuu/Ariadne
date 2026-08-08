"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { GraphEdge, Node, NodeStatus } from "@/lib/api";

// Nodes on a circle, edges as chords. Not a force layout: that needs a physics
// loop and a dependency, and this draws the same information deterministically,
// which also means it does not rearrange itself every time you open it.
//
// The two edge kinds differ by line, not only by colour, per the spec: a shared
// file is solid because it is a fact, a similarity is dashed because it is a
// guess.
//
// ponytail: a circle stops reading past roughly forty nodes, when the chords
// fill the middle. Swap in a force layout then, not before.

// Sized so the detail panel still fits beside it inside the content column at
// the window's minimum width, rather than wrapping under the canvas.
const SIZE = 440;
const RADIUS = SIZE / 2 - 40;
const DOT = 7;

const STATUS_FILL: Record<NodeStatus, string> = {
  confirmed: "var(--color-thread)",
  proposed: "var(--color-ochre-mark)",
  contradicted: "var(--color-iron)",
  archived: "var(--color-stone)",
};

export function NodeGraph({ nodes, edges }: { nodes: Node[]; edges: GraphEdge[] }) {
  const t = useTranslations("project");
  const [selected, setSelected] = useState<Node | null>(null);

  const at = new Map(
    nodes.map((node, i) => {
      // Start at the top and go clockwise, so the newest entry (the list is
      // sorted newest first) is always at twelve o'clock.
      const angle = (i / nodes.length) * 2 * Math.PI - Math.PI / 2;
      return [node.id, { x: SIZE / 2 + RADIUS * Math.cos(angle), y: SIZE / 2 + RADIUS * Math.sin(angle) }];
    }),
  );

  return (
    <div className="flex flex-wrap items-start gap-8">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="h-[440px] w-[440px] max-w-full shrink-0 bg-canvas"
        role="img"
        aria-label={t("graphLabel", { nodes: nodes.length, edges: edges.length })}
      >
        {edges.map((edge, i) => {
          const from = at.get(edge.from);
          const to = at.get(edge.to);
          if (!from || !to) return null;
          return (
            <line
              key={i}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="var(--color-thread-lift)"
              strokeWidth="1"
              strokeDasharray={edge.kind === "similarity" ? "4 4" : undefined}
              opacity={edge.kind === "similarity" ? 0.5 : 0.8}
            />
          );
        })}

        {nodes.map((node) => {
          const point = at.get(node.id);
          if (!point) return null;
          const current = selected?.id === node.id;
          return (
            <circle
              key={node.id}
              cx={point.x}
              cy={point.y}
              r={current ? DOT + 3 : DOT}
              fill={STATUS_FILL[node.status]}
              stroke="var(--color-canvas-ink)"
              strokeWidth={current ? 2 : 0}
              className="cursor-pointer"
              onClick={() => setSelected(node)}
            >
              <title>{node.content.slice(0, 120)}</title>
            </circle>
          );
        })}
      </svg>

      <div className="min-w-[260px] flex-1">
        {selected ? (
          <>
            <p className="font-data text-label uppercase tracking-[0.12em] text-ink-3">
              {selected.type} · {new Date(selected.createdAt).toISOString().slice(0, 10)}
            </p>
            <p className="whitespace-pre-wrap pt-3 text-small text-ink">{selected.content}</p>
          </>
        ) : (
          <p className="text-small text-ink-3">{t("graphHint")}</p>
        )}
      </div>
    </div>
  );
}
