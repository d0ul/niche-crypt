export declare function lzhufDecode(payload: Uint8Array, outLen: number): Buffer;
/** Compress to a raw LZHUF payload (no length header; keep the length yourself for decoding). */
export declare function lzhufEncode(data: Uint8Array): Buffer;
