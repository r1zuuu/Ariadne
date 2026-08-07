import type { NodeStatus } from "@/lib/api";

// Four statuses, four shapes. The test in the spec is to print the screen in
// greyscale and still tell them apart, so colour is the second signal and the
// outline is the first. Every mark carries its status name for a reader who
// gets neither, which is also why there is no legend anywhere in the product.

const MARKS: Record<NodeStatus, { shape: React.ReactNode; className: string }> = {
  confirmed: { shape: <rect x="0" y="0" width="10" height="10" fill="currentColor" />, className: "text-blue" },
  proposed: {
    shape: <path d="M5 0.4 9.6 5 5 9.6 0.4 5Z" fill="none" stroke="currentColor" strokeWidth="1.3" />,
    className: "text-ochre-mark",
  },
  contradicted: {
    shape: (
      <>
        <rect x="0.65" y="0.65" width="8.7" height="8.7" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <path d="M0.65 0.65 9.35 9.35" stroke="currentColor" strokeWidth="1.3" />
      </>
    ),
    className: "text-iron",
  },
  archived: { shape: <rect x="0" y="4" width="10" height="2" fill="currentColor" />, className: "text-slate" },
};

export function StatusMark({ status, label }: { status: NodeStatus; label: string }) {
  const mark = MARKS[status];
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      role="img"
      aria-label={label}
      className={`shrink-0 ${mark.className}`}
    >
      {mark.shape}
    </svg>
  );
}
