// SEED (KISA / RFC 4269) block cipher with CBC helper. Pure TS because the
// OpenSSL shipped with modern Node no longer exposes it.
import { SEED_S1, SEED_S2 } from "./seed-tables.js";
const hex = (s) => Uint8Array.from(Buffer.from(s, "hex"));
const S1 = hex(SEED_S1), S2 = hex(SEED_S2);
const MASKS = [0xfc, 0xf3, 0xcf, 0x3f];
const SS = [0, 1, 2, 3].map((t) => {
    const box = t % 2 ? S2 : S1;
    const tab = new Uint32Array(256);
    for (let x = 0; x < 256; x++) {
        let w = 0;
        for (let k = 0; k < 4; k++)
            w |= (box[x] & MASKS[(k + t) % 4]) << (8 * k);
        tab[x] = w >>> 0;
    }
    return tab;
});
const G = (x) => (SS[0][x & 255] ^ SS[1][(x >>> 8) & 255] ^ SS[2][(x >>> 16) & 255] ^ SS[3][x >>> 24]) >>> 0;
const rotl = (x, n) => ((x << n) | (x >>> (32 - n))) >>> 0;
export class Seed {
    rk = new Uint32Array(32);
    constructor(key) {
        if (key.length !== 16)
            throw new RangeError("SEED key must be 16 bytes");
        const dv = new DataView(key.buffer, key.byteOffset, 16);
        let a = dv.getUint32(0), b = dv.getUint32(4), c = dv.getUint32(8), d = dv.getUint32(12);
        let kc = 0x9e3779b9;
        for (let i = 0; i < 16; i++) {
            this.rk[2 * i] = G((a + c - kc) >>> 0);
            this.rk[2 * i + 1] = G((b - d + kc) >>> 0);
            if (i % 2 === 0) {
                const t = a;
                a = ((a >>> 8) | (b << 24)) >>> 0;
                b = ((b >>> 8) | (t << 24)) >>> 0;
            }
            else {
                const t = c;
                c = ((c << 8) | (d >>> 24)) >>> 0;
                d = ((d << 8) | (t >>> 24)) >>> 0;
            }
            kc = rotl(kc, 1);
        }
    }
    block(src, so, dst, d0, enc) {
        const sv = new DataView(src.buffer, src.byteOffset, src.byteLength);
        let l0 = sv.getUint32(so), l1 = sv.getUint32(so + 4), r0 = sv.getUint32(so + 8), r1 = sv.getUint32(so + 12);
        for (let i = 0; i < 16; i++) {
            const k = (enc ? i : 15 - i) * 2;
            let t0 = (r0 ^ this.rk[k]) >>> 0;
            let t1 = (r1 ^ this.rk[k + 1]) >>> 0;
            t1 = G((t1 ^ t0) >>> 0);
            t0 = G((t0 + t1) >>> 0);
            t1 = G((t1 + t0) >>> 0);
            t0 = (t0 + t1) >>> 0;
            [l0, l1, r0, r1] = [r0, r1, (l0 ^ t0) >>> 0, (l1 ^ t1) >>> 0];
        }
        const dv = new DataView(dst.buffer, dst.byteOffset, dst.byteLength);
        dv.setUint32(d0, r0);
        dv.setUint32(d0 + 4, r1);
        dv.setUint32(d0 + 8, l0);
        dv.setUint32(d0 + 12, l1);
    }
    encryptBlock(src, so = 0, dst = src, d0 = so) { this.block(src, so, dst, d0, true); }
    decryptBlock(src, so = 0, dst = src, d0 = so) { this.block(src, so, dst, d0, false); }
}
/** Stateful CBC decryptor/encryptor without padding; input must be a multiple of 16 bytes. */
export class SeedCbc {
    seed;
    iv;
    constructor(key, iv) {
        if (iv.length !== 16)
            throw new RangeError("SEED IV must be 16 bytes");
        this.seed = new Seed(key);
        this.iv = Uint8Array.from(iv);
    }
    decrypt(data) {
        if (data.length % 16)
            throw new RangeError("length must be a multiple of 16");
        const out = Buffer.alloc(data.length);
        for (let o = 0; o < data.length; o += 16) {
            this.seed.decryptBlock(data, o, out, o);
            const prev = o ? data.subarray(o - 16, o) : this.iv;
            for (let i = 0; i < 16; i++)
                out[o + i] ^= prev[i];
        }
        if (data.length)
            this.iv = Uint8Array.from(data.subarray(data.length - 16));
        return out;
    }
    encrypt(data) {
        if (data.length % 16)
            throw new RangeError("length must be a multiple of 16");
        const out = Buffer.alloc(data.length);
        for (let o = 0; o < data.length; o += 16) {
            const prev = o ? out.subarray(o - 16, o) : this.iv;
            for (let i = 0; i < 16; i++)
                out[o + i] = data[o + i] ^ prev[i];
            this.seed.encryptBlock(out, o);
        }
        if (data.length)
            this.iv = Uint8Array.from(out.subarray(out.length - 16));
        return out;
    }
}
