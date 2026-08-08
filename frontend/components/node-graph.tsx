"use client";

import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceCenter,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { GraphEdge, Node, NodeStatus } from "@/lib/api";

// A force layout run to rest before the first paint: d3-force settles the
// positions synchronously, so connected entries actually sit together and the
// picture never rearranges itself while someone is looking at it. No physics
// loop at runtime, which also keeps reduced motion trivially honest.
//
// The two edge kinds differ by line, not only by colour, per the spec: a shared
// file is solid because it is a fact, a similarity is dashed because it is a
// guess. Statuses keep their four marker shapes on the canvas, so the graph
// survives greyscale like everything else.

const WIDTH = 640;
const HEIGHT = 400;
const DOT = 8;

const STATUS_FILL: Record<NodeStatus, string> = {
  confirmed: "var(--color-laurel)",
  proposed: "var(--color-ochre-mark)",
  contradicted: "var(--color-iron)",
  archived: "var(--color-stone)",
};

type LaidOut = SimulationNodeDatum & { node: Node };

function settle(nodes: Node[], edges: GraphEdge[]) {
  const laid: LaidOut[] = nodes.map((node, i) => ({
    node,
    // Seeded on a circle rather than at random, so the same graph always
    // settles into the same picture.
    x: WIDTH / 2 + 120 * Math.cos((i / nodes.length) * 2 * Math.PI),
    y: HEIGHT / 2 + 120 * Math.sin((i / nodes.length) * 2 * Math.PI),
  }));
  const byId = new Map(laid.map((d) => [d.node.id, d]));
  const links: (SimulationLinkDatum<LaidOut> & { kind: GraphEdge["kind"] })[] = edges
    .filter((e) => byId.has(e.from) && byId.has(e.to))
    .map((e) => ({ source: e.from, target: e.to, kind: e.kind }));

  const simulation = forceSimulation(laid)
    .force("link", forceLink<LaidOut, SimulationLinkDatum<LaidOut>>(links)
      .id((d) => (d as LaidOut).node.id)
      .distance(120)
      .strength(0.4))
    .force("charge", forceManyBody().strength(-300))
    .force("center", forceCenter(WIDTH / 2, HEIGHT / 2))
    .force("x", forceX(WIDTH / 2).strength(0.06))
    .force("y", forceY(HEIGHT / 2).strength(0.08))
    .force("collide", forceCollide(DOT * 2.4))
    .stop();

  // 300 ticks is d3's own default cooling span; past it the layout is at rest.
  for (let i = 0; i < 300; i += 1) simulation.tick();

  // Pull the settled cloud back inside the frame.
  for (const d of laid) {
    d.x = Math.max(DOT + 14, Math.min(WIDTH - DOT - 14, d.x ?? WIDTH / 2));
    d.y = Math.max(DOT + 14, Math.min(HEIGHT - DOT - 14, d.y ?? HEIGHT / 2));
  }
  return { laid, links, byId };
}

function Mark({ status, x, y }: { status: NodeStatus; x: number; y: number }) {
  const fill = STATUS_FILL[status];
  switch (status) {
    case "proposed":
      return <circle cx={x} cy={y} r={DOT - 1.5} fill="none" stroke={fill} strokeWidth="2.5" />;
    case "confirmed":
      return <rect x={x - DOT + 1} y={y - DOT + 1} width={2 * DOT - 2} height={2 * DOT - 2} fill={fill} />;
    case "contradicted":
      return (
        <path
          d={`M${x - DOT + 2} ${y - DOT + 2}L${x + DOT - 2} ${y + DOT - 2}M${x + DOT - 2} ${y - DOT + 2}L${x - DOT + 2} ${y + DOT - 2}`}
          stroke={fill}
          strokeWidth="3"
          strokeLinecap="round"
        />
      );
    case "archived":
      return <path d={`M${x - DOT + 2} ${y}H${x + DOT - 2}`} stroke={fill} strokeWidth="3.5" strokeLinecap="round" />;
  }
}

export function NodeGraph({ nodes, edges }: { nodes: Node[]; edges: GraphEdge[] }) {
  const t = useTranslations("project");
  const tEntry = useTranslations("entry");
  const [selected, setSelected] = useState<Node | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const { laid, links } = useMemo(() => settle(nodes, edges), [nodes, edges]);

  const headline = (node: Node) => {
    const line = node.content.split("\n")[0];
    return line.length > 46 ? `${line.slice(0, 46)}…` : line;
  };

  const focused = selected?.id ?? hovered;
  const neighbours = new Set(
    links.flatMap((l) => {
      const from = (l.source as LaidOut).node.id;
      const to = (l.target as LaidOut).node.id;
      return from === focused || to === focused ? [from, to] : [];
    }),
  );

  return (
    <div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full rounded-card bg-canvas"
        role="img"
        aria-label={t("graphLabel", { nodes: nodes.length, edges: edges.length })}
      >
        {links.map((link, i) => {
          const from = link.source as LaidOut;
          const to = link.target as LaidOut;
          const near =
            !focused || from.node.id === focused || to.node.id === focused;
          return (
            <line
              key={i}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="var(--color-thread-lift)"
              strokeWidth={near && focused ? 1.6 : 1}
              strokeDasharray={link.kind === "similarity" ? "4 4" : undefined}
              opacity={near ? (link.kind === "similarity" ? 0.55 : 0.85) : 0.18}
            />
          );
        })}

        {laid.map((d) => {
          const { node } = d;
          const x = d.x ?? 0;
          const y = d.y ?? 0;
          const current = selected?.id === node.id;
          const dimmed = focused && node.id !== focused && !neighbours.has(node.id);
          const named = current || hovered === node.id || nodes.length <= 8;
          return (
            <g
              key={node.id}
              role="button"
              tabIndex={0}
              aria-label={headline(node)}
              className="cursor-pointer outline-none"
              opacity={dimmed ? 0.35 : 1}
              onClick={() => setSelected(current ? null : node)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelected(current ? null : node);
                }
              }}
              onMouseEnter={() => setHovered(node.id)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(node.id)}
              onBlur={() => setHovered(null)}
            >
              {/* A wider invisible target than the mark itself. */}
              <circle cx={x} cy={y} r={DOT * 2} fill="transparent" />
              {current ? (
                <circle
                  cx={x}
                  cy={y}
                  r={DOT + 5}
                  fill="none"
                  stroke="var(--color-canvas-ink)"
                  strokeWidth="1.5"
                  opacity="0.8"
                />
              ) : null}
              <Mark status={node.status} x={x} y={y} />
              {named ? (
                <text
                  x={x}
                  y={y - DOT - 8}
                  textAnchor="middle"
                  fill="var(--color-canvas-ink)"
                  fontSize="12"
                  opacity={current || hovered === node.id ? 1 : 0.75}
                >
                  {headline(node)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>

      {/* Legend in words and shapes, because on the canvas the shapes carry the
          statuses and a first-time reader should not have to guess. */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 pt-4">
        {(Object.keys(STATUS_FILL) as NodeStatus[]).map((status) => (
          <span key={status} className="inline-flex items-center gap-2 text-data text-ink-3">
            <svg width="10" height="10" viewBox="-8 -8 16 16" aria-hidden="true">
              <Mark status={status} x={0} y={0} />
            </svg>
            {tEntry(`status.${status}`)}
          </span>
        ))}
      </div>

      <div className="pt-4">
        {selected ? (
          <div className="border-l-2 border-thread/60 pl-5">
            <p className="text-data text-ink-3">
              {tEntry(`type.${selected.type}`)} ·{" "}
              {new Date(selected.createdAt).toLocaleDateString()}
            </p>
            <p className="max-w-[68ch] whitespace-pre-wrap pt-2 text-small leading-6 text-ink">
              {selected.content}
            </p>
          </div>
        ) : (
          <p className="text-small text-ink-3">{t("graphHint")}</p>
        )}
      </div>
    </div>
  );
}
