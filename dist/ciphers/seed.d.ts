export declare class Seed {
    private readonly rk;
    constructor(key: Uint8Array);
    private block;
    encryptBlock(src: Uint8Array, so?: number, dst?: Uint8Array<ArrayBufferLike>, d0?: number): void;
    decryptBlock(src: Uint8Array, so?: number, dst?: Uint8Array<ArrayBufferLike>, d0?: number): void;
}
/** Stateful CBC decryptor/encryptor without padding; input must be a multiple of 16 bytes. */
export declare class SeedCbc {
    private readonly seed;
    private iv;
    constructor(key: Uint8Array, iv: Uint8Array);
    decrypt(data: Uint8Array): Buffer;
    encrypt(data: Uint8Array): Buffer;
}
