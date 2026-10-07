export declare class Hight {
    private readonly WK;
    private readonly SK;
    private readonly native;
    constructor(key: Uint8Array, native?: boolean);
    private load;
    private store;
    encryptBlock(b: Uint8Array, o?: number): void;
    decryptBlock(b: Uint8Array, o?: number): void;
}
