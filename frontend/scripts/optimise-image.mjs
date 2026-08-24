// Turns the entry screen's source painting into the two files the app ships.
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
