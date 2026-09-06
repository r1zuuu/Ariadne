// Turns source images into the files the app ships: the entry screen's painting
// and the two agent marks the task list uses.
// Run from frontend/: node scripts/optimise-image.mjs
//
// sharp is not a dependency of this app; it arrives under Next. That is fine for
// a script run by hand that produces committed files, and it is why this is not
// wired into the build. The source PNG is not committed either, so this is a
// record of how public/thread-*.webp were made rather than a step anyone repeats.
import { statSync } from "node:fs";
import sharp from "sharp";

const kb = (path) => (statSync(path).size / 1024).toFixed(0);

// The source PNG is 5.2 MB, which is the whole rest of the bundle several times
// over for one screen. Two widths: the art panel is a little over half of a
// 1600px window, and the second covers a HiDPI screen without shipping the full
// 2208px original.
const ART = "public/ascii-magic-1.png";
console.log(`${ART.padEnd(34)} ${kb(ART)} kB  (source)`);

for (const width of [1000, 1600]) {
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
// on right now. They arrive as a 640px pixel-art PNG and a 768px gradient WebP
// and are drawn at eleven pixels, so almost all of both files is waste.
//
// Trimmed first, because both sources carry a wide transparent margin that would
// otherwise become empty space inside an eleven pixel box, leaving a mark too
// small to recognise. 44px is three times the drawn size, which covers a HiDPI
// screen with a little to spare.
//
// nearest for the Claude mark and nothing else for the other: it is pixel art,
// and a smooth kernel turns its hard edges into grey mush at this size.
const MARKS = [
  { from: "claudecode.png", to: "public/agent-claude.webp", kernel: "nearest" },
  { from: "codex-icon.webp", to: "public/agent-codex.webp", kernel: "lanczos3" },
];

for (const { from, to, kernel } of MARKS) {
  await sharp(from)
    .trim()
    .resize({ width: 44, height: 44, fit: "contain", kernel, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile(to);
  console.log(`${to.padEnd(34)} ${kb(to)} kB`);
}
