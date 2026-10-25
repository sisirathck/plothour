import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';

const sourcePath = path.resolve('public/plothour-mark-light.png');
const targetDir = path.resolve('extension/icons');
const src = PNG.sync.read(fs.readFileSync(sourcePath));

for (const targetSize of [16, 32, 48, 128]) {
  const out = new PNG({ width: targetSize, height: targetSize });
  for (let y = 0; y < targetSize; y++) {
    for (let x = 0; x < targetSize; x++) {
      const sx = ((x + 0.5) / targetSize) * src.width - 0.5;
      const sy = ((y + 0.5) / targetSize) * src.height - 0.5;
      const x0 = Math.max(0, Math.floor(sx));
      const y0 = Math.max(0, Math.floor(sy));
      const x1 = Math.min(src.width - 1, x0 + 1);
      const y1 = Math.min(src.height - 1, y0 + 1);
      const dx = Math.max(0, sx - x0);
      const dy = Math.max(0, sy - y0);
      const dst = (y * targetSize + x) * 4;
      const topLeft = (y0 * src.width + x0) * 4;
      const topRight = (y0 * src.width + x1) * 4;
      const bottomLeft = (y1 * src.width + x0) * 4;
      const bottomRight = (y1 * src.width + x1) * 4;
      for (let channel = 0; channel < 4; channel++) {
        const top = src.data[topLeft + channel] * (1 - dx) + src.data[topRight + channel] * dx;
        const bottom = src.data[bottomLeft + channel] * (1 - dx) + src.data[bottomRight + channel] * dx;
        out.data[dst + channel] = Math.round(top * (1 - dy) + bottom * dy);
      }
    }
  }
  fs.writeFileSync(path.join(targetDir, `icon${targetSize}.png`), PNG.sync.write(out));
  console.log(`Generated PlotHour hourglass icon${targetSize}.png`);
}
