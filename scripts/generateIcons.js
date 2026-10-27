import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// CRC32 implementation for PNG chunks
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcBuf = Buffer.alloc(4);
  const toCrc = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(toCrc), 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function createPng(size) {
  const width = size;
  const height = size;

  // Raw uncompressed scanlines: each row has 1 filter byte (0) + width * 4 bytes (RGBA)
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  const cx = width / 2;
  const cy = height / 2;
  const radius = size * 0.44;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter type 0 (None)

    for (let x = 0; x < width; x++) {
      const px = rowOffset + 1 + x * 4;

      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Rounded rectangle / badge background: purple game gradient
      const normY = y / height;
      let r = Math.round(124 - normY * 36); // #7c3aed to #581c87
      let g = Math.round(58 - normY * 30);
      let b = Math.round(237 - normY * 102);
      let a = 255;

      // Outer squircle clip
      const sqX = Math.abs(dx) / (size * 0.44);
      const sqY = Math.abs(dy) / (size * 0.44);
      const squircleDist = Math.pow(sqX, 4) + Math.pow(sqY, 4);

      if (squircleDist > 1.0) {
        // Transparent outside rounded icon
        r = 0; g = 0; b = 0; a = 0;
      } else {
        // Inner gold / spy glasses motif
        // Glasses center left & right
        const eyeOffset = size * 0.17;
        const eyeY = cy - size * 0.04;
        const eyeR = size * 0.13;

        const dLeft = Math.sqrt((x - (cx - eyeOffset)) ** 2 + (y - eyeY) ** 2);
        const dRight = Math.sqrt((x - (cx + eyeOffset)) ** 2 + (y - eyeY) ** 2);

        // Bridge between glasses
        const inBridge = Math.abs(y - eyeY) < size * 0.035 && Math.abs(dx) < eyeOffset;

        // Hat brim above
        const hatY = cy - size * 0.22;
        const inBrim = (y >= hatY && y <= hatY + size * 0.04 && Math.abs(dx) < size * 0.32);
        const inHat = (y < hatY && y >= hatY - size * 0.15 && Math.abs(dx) < size * 0.22);

        if (dLeft < eyeR || dRight < eyeR || inBridge || inBrim || inHat) {
          // Golden yellow with bevel highlight
          const isHighlight = (y < eyeY - eyeR * 0.5) || inHat;
          r = isHighlight ? 254 : 250;
          g = isHighlight ? 240 : 204;
          b = isHighlight ? 138 : 21; // #facc15
        }

        // Inner lens cutouts (darker lens)
        if (dLeft < eyeR * 0.65 || dRight < eyeR * 0.65) {
          r = 46; g = 16; b = 101; // Deep purple lens
        }
      }

      rawData[px] = r;
      rawData[px + 1] = g;
      rawData[px + 2] = b;
      rawData[px + 3] = a;
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // IDAT Chunk
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressed);

  // IEND Chunk
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const iconsDir = path.join(process.cwd(), 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), createPng(192));
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), createPng(512));
fs.writeFileSync(path.join(iconsDir, 'maskable-icon-512.png'), createPng(512));

console.log('✓ Successfully generated PWA icons: icon-192.png, icon-512.png, maskable-icon-512.png');
