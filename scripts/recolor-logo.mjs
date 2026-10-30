// Derives the orange-accent logo from the official blue logo.
// Usage: node scripts/recolor-logo.mjs
import sharp from "sharp";

const source = "src/renderer/src/assets/branding/tunevault-wolf-concept.png";
const output = "src/renderer/src/assets/branding/tunevault-wolf-orange.png";
const { data, info } = await sharp(source)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const toHsl = (r, g, b) => {
  ((r /= 255), (g /= 255), (b /= 255));
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min,
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r
      ? (g - b) / d + (g < b ? 6 : 0)
      : max === g
        ? (b - r) / d + 2
        : (r - g) / d + 4;
  return [h * 60, s, l];
};
const toRgb = (h, s, l) => {
  const k = (n) => (n + h / 30) % 12,
    a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
};
for (let i = 0; i < data.length; i += 4) {
  const [h, s, l] = toHsl(data[i], data[i + 1], data[i + 2]);
  // Keep the navy outline and neutral highlights; only blue fills become orange.
  if (s < 0.15 || l < 0.22 || h < 170 || h > 250) continue;
  [data[i], data[i + 1], data[i + 2]] = toRgb(26, Math.min(1, s * 1.02), l);
}
await sharp(data, { raw: info }).png({ compressionLevel: 9 }).toFile(output);
console.log(`Wrote ${output}`);
