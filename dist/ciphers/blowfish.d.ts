export declare class Blowfish {
    private readonly P;
    private readonly S;
    constructor(key: Uint8Array);
    private f;
    encryptWords(l: number, r: number): [number, number];
    decryptWords(l: number, r: number): [number, number];
    /** Big-endian 8-byte block, in place. */
    decryptBlock(buf: Uint8Array, off?: number): void;
    encryptBlock(buf: Uint8Array, off?: number): void;
    private run;
}
