export declare class LzoError extends Error {
}
export declare function lzo1xDecompress(src: Uint8Array, opts?: {
    maxOutput?: number;
    allowTrailing?: boolean;
}): Buffer;
