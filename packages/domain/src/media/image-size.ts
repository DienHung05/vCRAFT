/**
 * Pixel size of an image read from its header alone (no decoding), so the API can refuse a huge
 * "decompression bomb" at upload time instead of letting the worker fail it minutes later.
 * Supports PNG, JPEG, WebP and the ISO-BMFF family (AVIF, HEIC, HEIF); returns `undefined` for anything else.
 */
export interface ImageSize {
  readonly width: number;
  readonly height: number;
}

const u16be = (b: Uint8Array, o: number) => ((b[o] ?? 0) << 8) | (b[o + 1] ?? 0);
const u24le = (b: Uint8Array, o: number) =>
  (b[o] ?? 0) | ((b[o + 1] ?? 0) << 8) | ((b[o + 2] ?? 0) << 16);
const u32be = (b: Uint8Array, o: number) =>
  ((b[o] ?? 0) * 0x1000000 + ((b[o + 1] ?? 0) << 16) + ((b[o + 2] ?? 0) << 8) + (b[o + 3] ?? 0)) >>>
  0;
const ascii = (b: Uint8Array, o: number, n: number) => String.fromCharCode(...b.subarray(o, o + n));

function png(b: Uint8Array): ImageSize | undefined {
  // 8-byte signature, then the IHDR chunk: length(4) "IHDR"(4) width(4) height(4).
  if (b.length < 24 || ascii(b, 12, 4) !== 'IHDR') return undefined;
  return { width: u32be(b, 16), height: u32be(b, 20) };
}

function jpeg(b: Uint8Array): ImageSize | undefined {
  let offset = 2;
  while (offset + 9 < b.length) {
    if (b[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = b[offset + 1] ?? 0;
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    // Start-of-frame markers (baseline, progressive, ...) carry the size; DHT, JPG and DAC do not.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc)
      return { height: u16be(b, offset + 5), width: u16be(b, offset + 7) };
    // Standalone markers have no length field.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2;
      continue;
    }
    offset += 2 + u16be(b, offset + 2);
  }
  return undefined;
}

function webp(b: Uint8Array): ImageSize | undefined {
  if (b.length < 30 || ascii(b, 0, 4) !== 'RIFF' || ascii(b, 8, 4) !== 'WEBP') return undefined;
  const chunk = ascii(b, 12, 4);
  if (chunk === 'VP8X') return { width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
  if (chunk === 'VP8L') {
    const bits = (b[21] ?? 0) | ((b[22] ?? 0) << 8) | ((b[23] ?? 0) << 16) | ((b[24] ?? 0) << 24);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8 ')
    return {
      width: (b[26] ?? 0) | (((b[27] ?? 0) & 0x3f) << 8),
      height: (b[28] ?? 0) | (((b[29] ?? 0) & 0x3f) << 8),
    };
  return undefined;
}

/**
 * AVIF/HEIC/HEIF keep each image's size in an `ispe` box (version/flags(4) width(4) height(4)). A tiled
 * photo has one per tile plus one for the whole image, so the largest area wins.
 */
function isobmff(b: Uint8Array): ImageSize | undefined {
  if (b.length < 12 || ascii(b, 4, 4) !== 'ftyp') return undefined;
  let best: ImageSize | undefined;
  const limit = Math.min(b.length, 64 * 1024);
  for (let i = 4; i + 16 <= limit; i++) {
    if (b[i] === 0x69 && ascii(b, i, 4) === 'ispe') {
      const width = u32be(b, i + 8);
      const height = u32be(b, i + 12);
      if (!best || width * height > best.width * best.height) best = { width, height };
    }
  }
  return best;
}

export function readImageSize(bytes: Uint8Array): ImageSize | undefined {
  const size =
    bytes[0] === 0x89 && bytes[1] === 0x50
      ? png(bytes)
      : bytes[0] === 0xff && bytes[1] === 0xd8
        ? jpeg(bytes)
        : bytes[0] === 0x52
          ? webp(bytes)
          : isobmff(bytes);
  return size && size.width > 0 && size.height > 0 ? size : undefined;
}
