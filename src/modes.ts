export interface BlockCipher8 {
  encryptBlock(buf: Uint8Array, off?: number): void;
  decryptBlock(buf: Uint8Array, off?: number): void;
}

/** ECB over a whole buffer (length must be a multiple of 8). Returns a new Buffer. */
export function ecb(cipher: BlockCipher8, data: Uint8Array, mode: "encrypt" | "decrypt"): Buffer {
  if (data.length % 8) throw new RangeError("length must be a multiple of 8");
  const out = Buffer.from(data);
  for (let o = 0; o < out.length; o += 8) {
    if (mode === "encrypt") cipher.encryptBlock(out, o);
    else cipher.decryptBlock(out, o);
  }
  return out;
}

/** CBC over a whole buffer for 8-byte-block ciphers (length must be a multiple of 8, no padding). */
export function cbc(cipher: BlockCipher8, iv: Uint8Array, data: Uint8Array, mode: "encrypt" | "decrypt"): Buffer {
  if (iv.length !== 8) throw new RangeError("IV must be 8 bytes");
  if (data.length % 8) throw new RangeError("length must be a multiple of 8");
  const out = Buffer.from(data);
  let prev = Uint8Array.from(iv);
  for (let o = 0; o < out.length; o += 8) {
    if (mode === "encrypt") {
      for (let i = 0; i < 8; i++) out[o + i] ^= prev[i];
      cipher.encryptBlock(out, o);
      prev = out.subarray(o, o + 8);
    } else {
      const ct = Uint8Array.from(out.subarray(o, o + 8));
      cipher.decryptBlock(out, o);
      for (let i = 0; i < 8; i++) out[o + i] ^= prev[i];
      prev = ct;
    }
  }
  return out;
}

export function pkcs7Pad(data: Uint8Array, blockSize: number): Buffer {
  const n = blockSize - (data.length % blockSize);
  return Buffer.concat([data, Buffer.alloc(n, n)]);
}

export function pkcs7Unpad(data: Uint8Array, blockSize: number): Buffer {
  const n = data[data.length - 1];
  if (!data.length || data.length % blockSize || n < 1 || n > blockSize) throw new RangeError("bad padding");
  for (let i = 1; i <= n; i++) if (data[data.length - i] !== n) throw new RangeError("bad padding");
  return Buffer.from(data.subarray(0, data.length - n));
}
