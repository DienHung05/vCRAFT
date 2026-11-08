declare module 'heic-decode' {
  interface DecodedHeic {
    width: number;
    height: number;
    /** RGBA, 4 bytes per pixel. */
    data: Uint8ClampedArray;
  }
  /** Decodes the primary image of a HEIC/HEIF file (libheif compiled to WebAssembly). */
  export default function decode(input: { buffer: Uint8Array | ArrayBuffer }): Promise<DecodedHeic>;
}
