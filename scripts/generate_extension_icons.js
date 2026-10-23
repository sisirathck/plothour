import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';

const logoPath = path.resolve('asset/studyduel_logo.png');
const targetDir = path.resolve('extension/icons');

fs.createReadStream(logoPath)
  .pipe(new PNG())
  .on('parsed', function() {
    const src = this;

    // Hourglass mark bounds: x: 30 to 249, y: 26 to 238
    const minX = 30;
    const maxX = 249;
    const minY = 26;
    const maxY = 238;

    const width = maxX - minX;
    const height = maxY - minY;
    const maxDim = Math.max(width, height);
    const padding = 12;
    const boxSize = maxDim + padding * 2;

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const cropX = centerX - boxSize / 2;
    const cropY = centerY - boxSize / 2;

    const iconSizes = [16, 32, 48, 128];

    iconSizes.forEach((targetSize) => {
      const out = new PNG({ width: targetSize, height: targetSize });

      for (let ty = 0; ty < targetSize; ty++) {
        for (let tx = 0; tx < targetSize; tx++) {
          const outIdx = (targetSize * ty + tx) << 2;

          const sx = cropX + (tx / targetSize) * boxSize;
          const sy = cropY + (ty / targetSize) * boxSize;

          const x0 = Math.floor(sx);
          const y0 = Math.floor(sy);
          const x1 = Math.min(src.width - 1, x0 + 1);
          const y1 = Math.min(src.height - 1, y0 + 1);

          const dx = sx - x0;
          const dy = sy - y0;

          if (x0 >= 0 && x1 < 251 && y0 >= 0 && y1 < src.height) {
            const i00 = (src.width * y0 + x0) << 2;
            const i10 = (src.width * y0 + x1) << 2;
            const i01 = (src.width * y1 + x0) << 2;
            const i11 = (src.width * y1 + x1) << 2;

            for (let c = 0; c < 4; c++) {
              const top = src.data[i00 + c] * (1 - dx) + src.data[i10 + c] * dx;
              const bot = src.data[i01 + c] * (1 - dx) + src.data[i11 + c] * dx;
              out.data[outIdx + c] = Math.round(top * (1 - dy) + bot * dy);
            }
          } else {
            out.data[outIdx] = 0;
            out.data[outIdx + 1] = 0;
            out.data[outIdx + 2] = 0;
            out.data[outIdx + 3] = 0;
          }
        }
      }

      const outPath = path.join(targetDir, `icon${targetSize}.png`);
      out.pack().pipe(fs.createWriteStream(outPath));
      console.log(`Generated perfect StudyDuel hourglass icon${targetSize}.png`);
    });
  });
