import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

// Decode and re-encode to reject spoofed files and discard source metadata.
// WebP and camera images are normalized to JPEG by the browser before upload.
export function normalizeImage(buffer) {
  let decoded;
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    if (buffer.length < 24) throw new Error('Truncated PNG');
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    if (!width || !height || width * height > 40_000_000) throw new Error('Image too large');
    decoded = PNG.sync.read(buffer, { checkCRC: true });
  } else if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    decoded = jpeg.decode(buffer, { useTArray: true, maxResolutionInMP: 40, maxMemoryUsageInMB: 512, tolerantDecoding: false });
  } else throw new Error('Unsupported image');
  for (let i = 0; i < decoded.data.length; i += 4) {
    const alpha = decoded.data[i + 3] / 255;
    for (let channel = 0; channel < 3; channel++) decoded.data[i + channel] = Math.round(decoded.data[i + channel] * alpha + 24 * (1 - alpha));
    decoded.data[i + 3] = 255;
  }
  return jpeg.encode(decoded, 92).data;
}
