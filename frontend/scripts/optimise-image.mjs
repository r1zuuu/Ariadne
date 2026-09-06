// Turns source images into the files the app ships: the entry screen's painting
// and the two agent marks the task list uses.
// Run from frontend/: node scripts/optimise-image.mjs
//
// sharp is not a dependency of this app; it arrives under Next. That is fine for
// a script run by hand that produces committed files, and it is why this is not
// wired into the build. The source PNG is not committed either, so this is a
// record of how public/thread-*.webp were made rather than a step anyone repeats.
import { existsSync, statSync } from "node:fs";
import sharp from "sharp";

const kb = (path) => (statSync(path).size / 1024).toFixed(0);

// The source PNG is 5.2 MB, which is the whole rest of the bundle several times
// over for one screen. Two widths: the art panel is a little over half of a
// 1600px window, and the second covers a HiDPI screen without shipping the full
// 2208px original.
const ART = "public/ascii-magic-1.png";

// The source is not committed, so on a fresh checkout this half has nothing to
// do. Skipped rather than thrown, because the agent marks below are the part
// anyone actually reruns and they should not need a 5 MB painting to be present.
if (!existsSync(ART)) {
  console.log(`${ART.padEnd(34)} skipped, source not here`);
}
console.log(existsSync(ART) ? `${ART.padEnd(34)} ${kb(ART)} kB  (source)` : "");

for (const width of existsSync(ART) ? [1000, 1600] : []) {
  const out = `public/thread-${width}.webp`;
  await sharp(ART)
    .resize({ width, withoutEnlargement: true })
    // quality 82 is where this image stops improving: it is a dark painting with
    // a fine dither, and the dither is the first thing to smear below it.
    .webp({ quality: 82 })
    .toFile(out);
  console.log(`${out.padEnd(34)} ${kb(out)} kB`);
}

// The marks for Claude Code and Codex, shown beside a task somebody is working
// on right now. They arrive as a 640px pixel-art PNG and a 768px WebP and are
// drawn at fourteen pixels, so almost all of both files is waste.
//
// The Codex source has no alpha channel at all: its "transparent" background is
// a grey and white chequerboard painted into the pixels, the way stock sites
// hand one out. Dropped in as it came, the mark sat on a pale square. So the
// alpha is rebuilt here from chroma, which separates the two cleanly on this
// image: the chequer tones measure 3 to 6, the flower 88 to 186. The ramp from
// 12 to 40 keeps the antialiased rim from turning into a hard edge.
//
// It knocks the glyph out too, and that is correct: the > and _ inside the mark
// are holes in the logo, not white ink, and they measure as background because
// that is what they are.
const CHROMA_CLEAR = 12;
const CHROMA_SOLID = 40;

async function alphaFromChroma(file) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const alpha = Buffer.alloc(info.width * info.height);
  // Bounding box of everything that survives, so the wide empty margin goes
  // before the resize rather than eating half of a fourteen pixel box.
  let top = info.height, left = info.width, right = -1, bottom = -1;
  for (let p = 0; p < alpha.length; p++) {
    const i = p * info.channels;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);
    const value = Math.round(
      255 * Math.min(1, Math.max(0, (chroma - CHROMA_CLEAR) / (CHROMA_SOLID - CHROMA_CLEAR))),
    );
    alpha[p] = value;
    if (value > 8) {
      const x = p % info.width;
      const y = (p / info.width) | 0;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  // Materialised to PNG rather than handed on as a raw pipeline: extract and
  // resize chained onto a raw input silently did nothing here and wrote the
  // source at full size. Two passes, no subtlety.
  const rgba = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  })
    .joinChannel(alpha, { raw: { width: info.width, height: info.height, channels: 1 } })
    .png()
    .toBuffer();

  return { rgba, box: { left, top, width: right - left + 1, height: bottom - top + 1 } };
}

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

// 44px is three times the drawn size, which covers a HiDPI screen with a little
// to spare. nearest for the Claude mark and nothing else: it is pixel art, and a
// smooth kernel turns its hard edges into grey mush at this size.
{
  await sharp("scripts/marks/claude-code.png")
    .trim()
    .resize({ width: 44, height: 44, fit: "contain", kernel: "nearest", background: TRANSPARENT })
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile("public/agent-claude.webp");
  console.log(`${"public/agent-claude.webp".padEnd(34)} ${kb("public/agent-claude.webp")} kB`);

  const { rgba, box } = await alphaFromChroma("scripts/marks/codex.webp");
  await sharp(rgba)
    .extract(box)
    .resize({ width: 44, height: 44, fit: "contain", background: TRANSPARENT })
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile("public/agent-codex.webp");
  console.log(`${"public/agent-codex.webp".padEnd(34)} ${kb("public/agent-codex.webp")} kB`);
}
