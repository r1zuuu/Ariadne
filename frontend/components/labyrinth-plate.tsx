// The plate on the entry screen: the labyrinth drawn as one unbroken line, with
// the thread leaving the bottom edge. One path, one stroke width, one colour,
// which is the same rule the meander follows and the reason the mono was chosen.
//
// The geometry is generated rather than hand-typed: concentric rectangles, each
// open on one side and joined to the next, so the whole figure is a single
// continuous line you could trace with a finger.
//
// ponytail: a rectangular meander, not the true seven-circuit Cretan topology.
// It reads as a labyrinth at plate scale and costs a loop instead of forty
// hand-placed coordinates. Swap in the real topology if the plate ever grows
// large enough for anyone to trace it.

const CIRCUITS = 7;
const GAP = 13;
const SIZE = 220;
const TAIL = 46;

function labyrinthPath(): string {
  const points: Array<[number, number]> = [];
  let left = 8;
  let top = 8;
  let right = SIZE - 8;
  let bottom = SIZE - 8;

  // Enter at the bottom, one gap right of centre, then fold inward.
  points.push([SIZE / 2 + GAP / 2, bottom]);

  for (let i = 0; i < CIRCUITS; i++) {
    points.push([right, bottom]);
    points.push([right, top]);
    points.push([left, top]);
    points.push([left, bottom]);
    // Stop short of closing the ring: the gap is what keeps it one line.
    points.push([SIZE / 2 - GAP / 2, bottom]);
    points.push([SIZE / 2 - GAP / 2, bottom - GAP]);
    points.push([SIZE / 2 + GAP / 2, bottom - GAP]);

    left += GAP;
    top += GAP;
    right -= GAP;
    bottom -= GAP;
    if (right - left < GAP * 2) break;
  }

  return `M ${points.map(([x, y]) => `${x} ${y}`).join(" L ")}`;
}

const PATH = labyrinthPath();

export function LabyrinthPlate() {
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE + TAIL}`}
      width={SIZE}
      height={SIZE + TAIL}
      role="img"
      aria-label="Labirynt narysowany jedna linia, z nicia wychodzaca w dol"
      className="text-blue"
    >
      <path
        d={PATH}
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="miter"
        vectorEffect="non-scaling-stroke"
      />
      {/* The thread: the same line continuing past the figure, which is the whole
          point of the myth and the product. */}
      <path
        d={`M ${SIZE / 2 + GAP / 2} ${SIZE - 8} L ${SIZE / 2 + GAP / 2} ${SIZE + TAIL}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
