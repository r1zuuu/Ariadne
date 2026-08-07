// The plate on the entry screen: the labyrinth drawn as one unbroken line, with
// the thread leaving the bottom edge. One path, one stroke width, one colour,
// which is the same rule the meander follows and the reason the mono was chosen.
//
// The geometry is generated rather than hand-typed: concentric rectangles, each
// open on one side and joined to the next, so the whole figure is a single
// continuous line you could trace with a finger.
//
// ponytail: a rectangular meander, not the true seven-circuit Cretan topology.
// It reads as a labyrinth and costs a loop instead of forty hand-placed
// coordinates. Swap in the real topology when someone actually traces it, which
// is exactly what the cursor-lit version in the plan will invite.

const CIRCUITS = 9;
const MARGIN = 10;

function labyrinthPath(size: number, gap: number): string {
  const points: Array<[number, number]> = [];
  let left = MARGIN;
  let top = MARGIN;
  let right = size - MARGIN;
  let bottom = size - MARGIN;

  // Enter at the bottom, one half-gap right of centre, then fold inward.
  points.push([size / 2 + gap / 2, bottom]);

  for (let i = 0; i < CIRCUITS; i++) {
    points.push([right, bottom]);
    points.push([right, top]);
    points.push([left, top]);
    points.push([left, bottom]);
    // Stopping short of closing the ring is what keeps the figure one line.
    points.push([size / 2 - gap / 2, bottom]);
    points.push([size / 2 - gap / 2, bottom - gap]);
    points.push([size / 2 + gap / 2, bottom - gap]);

    left += gap;
    top += gap;
    right -= gap;
    bottom -= gap;
    if (right - left < gap * 2) break;
  }

  return `M ${points.map(([x, y]) => `${x} ${y}`).join(" L ")}`;
}

export function LabyrinthPlate({ size = 440 }: { size?: number }) {
  // Derived from the size so the density stays the same whatever the plate
  // measures, instead of turning into a coarse grid when it grows.
  const gap = (size - MARGIN * 2) / (CIRCUITS * 2 + 1);
  const tail = size * 0.22;

  return (
    <svg
      viewBox={`0 0 ${size} ${size + tail}`}
      width={size}
      height={size + tail}
      role="img"
      aria-label="Labirynt narysowany jedna linia, z nicia wychodzaca w dol"
      className="text-blue"
    >
      <path
        d={labyrinthPath(size, gap)}
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="miter"
        vectorEffect="non-scaling-stroke"
      />
      {/* The thread: the same line continuing past the figure, which is the whole
          point of the myth and of the product. */}
      <path
        d={`M ${size / 2 + gap / 2} ${size - MARGIN} L ${size / 2 + gap / 2} ${size + tail}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
