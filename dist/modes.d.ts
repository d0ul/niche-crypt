export interface BlockCipher8 {
    encryptBlock(buf: Uint8Array, off?: number): void;
    decryptBlock(buf: Uint8Array, off?: number): void;
}
/** ECB over a whole buffer (length must be a multiple of 8). Returns a new Buffer. */
export declare function ecb(cipher: BlockCipher8, data: Uint8Array, mode: "encrypt" | "decrypt"): Buffer;
/** CBC over a whole buffer for 8-byte-block ciphers (length must be a multiple of 8, no padding). */
export declare function cbc(cipher: BlockCipher8, iv: Uint8Array, data: Uint8Array, mode: "encrypt" | "decrypt"): Buffer;
export declare function pkcs7Pad(data: Uint8Array, blockSize: number): Buffer;
export declare function pkcs7Unpad(data: Uint8Array, blockSize: number): Buffer;
