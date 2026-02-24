/**
 * icon.png에서 회색 배경을 투명하게 만드는 스크립트
 * 사용: node scripts/make-icon-transparent.mjs
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const iconPath = join(root, 'app', 'icon.png');

// 회색 판별: R≈G≈B이고, 밝기가 중간 영역(배경으로 추정)
function isGray(r, g, b, tolerance = 35, brightnessMin = 80, brightnessMax = 220) {
  const diff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
  const brightness = (r + g + b) / 3;
  return diff <= tolerance && brightness >= brightnessMin && brightness <= brightnessMax;
}

async function main() {
  const input = readFileSync(iconPath);
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const bytes = new Uint8Array(data);

  for (let i = 0; i < bytes.length; i += channels) {
    const r = bytes[i];
    const g = bytes[i + 1];
    const b = bytes[i + 2];
    if (isGray(r, g, b)) {
      bytes[i + 3] = 0; // 알파 0 = 투명
    }
  }

  await sharp(bytes, { raw: { width, height, channels } })
    .png()
    .toFile(iconPath);

  console.log('OK: app/icon.png 배경을 투명 처리했습니다.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
