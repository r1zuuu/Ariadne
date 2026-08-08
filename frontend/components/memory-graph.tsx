"use client";

import {
  Background,
  BackgroundVariant,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node as FlowNode,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useLocale } from "@/app/locale-provider";
import { Meta, Status } from "@/components/ui";
import type { GraphEdge, Node } from "@/lib/api";

// The project's memory as a map, drawn by React Flow. Every node is a real
// card in the design system - status, first line, date - because the previous
// attempt (abstract dots on a dark canvas) showed shapes without words, the
// one thing this app promised never to do.
//
// Layout is deterministic, not physical: entries run oldest to newest along a
// horizontal thread, alternating above and below it, so the same archive
// always draws the same picture. The two edge kinds keep their difference by
// line: a shared file is solid because it is a fact, a similarity is dashed
// because it is a guess.

const COLUMN = 370;
const LANE = 105;

type EntryFlowNode = FlowNode<{ entry: Node; stamp: string }, "entry">;

function EntryNode({ data, selected }: NodeProps<EntryFlowNode>) {
  const tEntry = useTranslations("entry");
  const { entry, stamp } = data;
  return (
    <div
      className={`w-[250px] rounded-card border bg-surface p-4 shadow-card transition-[border-color] duration-state ${
        selected ? "border-thread" : "border-hairline"
      }`}
    >
      <Handle type="target" position={Position.Left} className="!invisible" />
      <Status tone={entry.status}>{tEntry(`status.${entry.status}`)}</Status>
      <p className="line-clamp-3 pt-2 text-small font-medium leading-6 text-ink">
        {entry.content.split("\n")[0]}
      </p>
      <div className="pt-2">
        <Meta items={[tEntry(`type.${entry.type}`), stamp]} />
      </div>
      <Handle type="source" position={Position.Right} className="!invisible" />
    </div>
  );
}

const nodeTypes = { entry: EntryNode };

export function MemoryGraph({ nodes, edges }: { nodes: Node[]; edges: GraphEdge[] }) {
  const t = useTranslations("project");
  const { locale } = useLocale();
  const [selected, setSelected] = useState<Node | null>(null);

  const { flowNodes, flowEdges } = useMemo(() => {
    const stamp = (iso: string) =>
      new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(iso));
    const ordered = [...nodes].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const flowNodes: EntryFlowNode[] = ordered.map((entry, i) => ({
      id: entry.id,
      type: "entry",
      position: { x: i * COLUMN, y: (i % 2 === 0 ? -1 : 1) * LANE },
      data: { entry, stamp: stamp(entry.createdAt) },
    }));
    // Edges always run older to newer. The handles sit right and left, so an
    // edge against the timeline would loop all the way around both cards.
    const index = new Map(ordered.map((entry, i) => [entry.id, i]));
    const flowEdges: Edge[] = edges
      .filter((e) => e.from !== e.to)
      .map((e, i) => {
        const backwards = (index.get(e.from) ?? 0) > (index.get(e.to) ?? 0);
        return {
          id: `${e.kind}-${i}`,
          source: backwards ? e.to : e.from,
          target: backwards ? e.from : e.to,
          style: {
            stroke: "var(--color-thread)",
            strokeWidth: 1.5,
            strokeDasharray: e.kind === "similarity" ? "5 5" : undefined,
            opacity: e.kind === "similarity" ? 0.4 : 0.65,
          },
        };
      });
    return { flowNodes, flowEdges };
  }, [nodes, edges, locale]);

  return (
    <div>
      <div className="h-[440px] overflow-hidden rounded-card border border-hairline bg-plaster-sunk/50">
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.12, maxZoom: 1 }}
          /* The floor keeps every card legible: a big archive pans instead of
             shrinking into confetti. */
          minZoom={0.75}
          maxZoom={1.4}
          nodesConnectable={false}
          deleteKeyCode={null}
          onNodeClick={(_, node) => {
            const entry = (node as EntryFlowNode).data.entry;
            setSelected((current) => (current?.id === entry.id ? null : entry));
          }}
          onPaneClick={() => setSelected(null)}
          aria-label={t("graphLabel", { nodes: nodes.length, edges: edges.length })}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} color="var(--color-edge)" />
        </ReactFlow>
      </div>

      <div className="pt-4">
        {selected ? (
          <div className="border-l-2 border-thread/60 pl-5">
            <p className="max-w-[68ch] whitespace-pre-wrap text-small leading-6 text-ink">
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
