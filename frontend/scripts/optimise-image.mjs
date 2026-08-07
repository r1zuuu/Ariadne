// Turns the art-direction source into web-sized WebP next to it.
// The source PNG is 5.2 MB, which is the whole rest of the bundle several times
// over for one login screen. Run from frontend/: node scripts/optimise-image.mjs
//
// sharp is not a dependency of this app; it arrives under Next. That is fine for
// a script run by hand that produces a committed file, and it is why this is not
// wired into the build.
import { statSync } from "node:fs";
import sharp from "sharp";

const SOURCE = "public/ascii-magic-1.png";
// Two widths: the art panel is a little over half of a 1600px window, and the
// second covers a HiDPI screen without shipping the full 2208px original.
const WIDTHS = [1000, 1600];

const kb = (path) => (statSync(path).size / 1024).toFixed(0);
console.log(`${SOURCE.padEnd(34)} ${kb(SOURCE)} kB  (source)`);

for (const width of WIDTHS) {
  const out = `public/thread-${width}.webp`;
  await sharp(SOURCE)
    .resize({ width, withoutEnlargement: true })
    // quality 82 is where this image stops improving: it is a dark painting with
    // a fine dither, and the dither is the first thing to smear below it.
    .webp({ quality: 82 })
    .toFile(out);
  console.log(`${out.padEnd(34)} ${kb(out)} kB`);
}
