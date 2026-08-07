// Turns the two committed source images into what the app actually ships.
// Run from frontend/: node scripts/optimise-image.mjs
//
// sharp is not a dependency of this app; it arrives under Next. That is fine for
// a script run by hand that produces committed files, and it is why this is not
// wired into the build.
import { statSync } from "node:fs";
import sharp from "sharp";

const kb = (path) => (statSync(path).size / 1024).toFixed(0);

// --- Login art -------------------------------------------------------------
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

// --- Wordmark --------------------------------------------------------------
// The logo arrives as a 1 MB PNG on a white square. Two problems for the app:
// the white would show as a rectangle on the tinted background, and the padding
// means the mark renders smaller than the box it occupies.
//
// So: trim the padding, drop white to transparent, and emit the sizes the UI
// asks for. Kept as PNG rather than WebP because it is flat blue line art where
// PNG is both smaller and lossless, and because the Tauri icon pipeline wants
// PNG anyway.
const LOGO = "public/Logo.png";
const meta = await sharp(LOGO).metadata();
console.log(`\n${LOGO.padEnd(34)} ${kb(LOGO)} kB  (source, ${meta.width}x${meta.height}, alpha=${meta.hasAlpha})`);

// The mark is one solid blue on white, so "not near-white" is a clean mask.
// Done on the raw pixels rather than with a chroma key, which would fringe the
// anti-aliased curves.
const flat = await sharp(LOGO).trim({ threshold: 10 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { data, info } = flat;
for (let i = 0; i < data.length; i += info.channels) {
  const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
  // Alpha follows how far the pixel is from white, so an anti-aliased edge
  // fades out instead of turning into a hard staircase.
  const distance = 255 - Math.min(r, g, b);
  data[i + 3] = Math.min(255, Math.round(distance * 1.15));
}

const cut = sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } });
const square = Math.max(info.width, info.height);

for (const size of [64, 128, 512]) {
  const out = `public/logo-${size}.png`;
  await cut
    .clone()
    // Onto a square canvas first, so every output has the same aspect and the
    // UI can size it by height without the mark drifting.
    .resize(square, square, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`${out.padEnd(34)} ${kb(out)} kB`);
}
