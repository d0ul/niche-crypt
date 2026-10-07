// LZHUF (LZSS + adaptive Huffman) codec, Okumura/Yoshizaki style.
import { LZH_D_CODE, LZH_D_LEN } from "./lzhuf-tables.js";
const D_CODE = Buffer.from(LZH_D_CODE, "hex");
const D_LEN = Buffer.from(LZH_D_LEN, "hex");
const N = 4096, F = 60, THRESHOLD = 2;
const N_CHAR = 256 - THRESHOLD + F; // 314
const T = N_CHAR * 2 - 1; // 627
const R = T - 1;
const MAX_FREQ = 0x8000;
class Model {
    freq = new Int32Array(T + 1);
    prnt = new Int32Array(T + N_CHAR);
    son = new Int32Array(T);
    constructor() {
        for (let i = 0; i < N_CHAR; i++) {
            this.freq[i] = 1;
            this.son[i] = i + T;
            this.prnt[i + T] = i;
        }
        for (let i = 0, j = N_CHAR; j <= R; i += 2, j++) {
            this.freq[j] = this.freq[i] + this.freq[i + 1];
            this.son[j] = i;
            this.prnt[i] = this.prnt[i + 1] = j;
        }
        this.freq[T] = 0xffff;
        this.prnt[R] = 0;
    }
    reconst() {
        const { freq, son, prnt } = this;
        let j = 0;
        for (let i = 0; i < T; i++) {
            if (son[i] >= T) {
                freq[j] = (freq[i] + 1) >> 1;
                son[j] = son[i];
                j++;
            }
        }
        for (let i = 0, jj = N_CHAR; jj < T; i += 2, jj++) {
            const f = freq[i] + freq[i + 1];
            freq[jj] = f;
            let k = jj - 1;
            while (f < freq[k])
                k--;
            k++;
            if (jj > k) {
                freq.copyWithin(k + 1, k, jj);
                son.copyWithin(k + 1, k, jj);
            }
            freq[k] = f;
            son[k] = i;
        }
        for (let i = 0; i < T; i++) {
            const k = son[i];
            prnt[k] = i;
            if (k < T)
                prnt[k + 1] = i;
        }
    }
    update(c) {
        const { freq, son, prnt } = this;
        if (freq[R] === MAX_FREQ)
            this.reconst();
        c = prnt[c + T];
        do {
            const k = ++freq[c];
            let l = c + 1;
            if (k > freq[l]) {
                while (k > freq[l + 1])
                    l++;
                freq[c] = freq[l];
                freq[l] = k;
                const i = son[c];
                prnt[i] = l;
                if (i < T)
                    prnt[i + 1] = l;
                const j = son[l];
                son[l] = i;
                prnt[j] = c;
                if (j < T)
                    prnt[j + 1] = c;
                son[c] = j;
                c = l;
            }
            c = prnt[c];
        } while (c !== 0);
    }
}
class Decoder {
    pos = 0;
    getbuf = 0;
    getlen = 0;
    model = new Model();
    data;
    constructor(data) {
        this.data = data;
    }
    fill() {
        while (this.getlen <= 8) {
            const c = this.pos < this.data.length ? this.data[this.pos++] : 0;
            this.getbuf = (this.getbuf | (c << (8 - this.getlen))) >>> 0;
            this.getlen += 8;
        }
    }
    bit() {
        this.fill();
        const i = this.getbuf;
        this.getbuf = (this.getbuf << 1) >>> 0;
        this.getlen--;
        return (i >>> 15) & 1;
    }
    byte() {
        this.fill();
        const i = this.getbuf;
        this.getbuf = (this.getbuf << 8) >>> 0;
        this.getlen -= 8;
        return (i >>> 8) & 255;
    }
    bits(n) {
        if (n === 0)
            return 0;
        this.fill();
        const i = this.getbuf;
        this.getbuf = (this.getbuf << n) >>> 0;
        this.getlen -= n;
        return (i >>> (16 - n)) & ((1 << n) - 1);
    }
    decodeChar() {
        const { son } = this.model;
        let c = son[R];
        while (c < T)
            c = son[c + this.bit()];
        c -= T;
        this.model.update(c);
        return c;
    }
    decodePosition() {
        const i = this.byte();
        const j = D_LEN[i] - 2;
        const n = this.bits(j);
        return (D_CODE[i] << 6) | (((i << j) | n) & 0x3f);
    }
    decode(outLen) {
        const out = Buffer.alloc(outLen);
        const text = new Uint8Array(N + F - 1);
        text.fill(0x20, 0, N - F);
        let r = N - F, op = 0;
        while (op < outLen) {
            const c = this.decodeChar();
            if (c < 256) {
                out[op++] = c;
                text[r] = c;
                r = (r + 1) & (N - 1);
            }
            else {
                let pos = (r - this.decodePosition() - 1) & (N - 1);
                const len = c - 255 + THRESHOLD;
                for (let k = 0; k < len && op < outLen; k++) {
                    const b = text[pos & (N - 1)];
                    out[op++] = b;
                    text[r] = b;
                    r = (r + 1) & (N - 1);
                    pos++;
                }
            }
        }
        return out;
    }
}
export function lzhufDecode(payload, outLen) {
    return new Decoder(payload).decode(outLen);
}
// Position codes: for each 6-bit high part, the shortest prefix code implied by the decode tables.
const POS_LEN = new Uint8Array(64);
const POS_CODE = new Uint8Array(64);
for (let i = 255; i >= 0; i--) {
    POS_LEN[D_CODE[i]] = D_LEN[i];
    POS_CODE[D_CODE[i]] = i >> (8 - D_LEN[i]);
}
class BitWriter {
    bytes = [];
    acc = 0;
    n = 0;
    put(value, bits) {
        for (let i = bits - 1; i >= 0; i--) {
            this.acc = (this.acc << 1) | ((value >>> i) & 1);
            if (++this.n === 8) {
                this.bytes.push(this.acc);
                this.acc = 0;
                this.n = 0;
            }
        }
    }
    finish() {
        if (this.n)
            this.bytes.push((this.acc << (8 - this.n)) & 255);
        return Buffer.from(this.bytes);
    }
}
/** Compress to a raw LZHUF payload (no length header; keep the length yourself for decoding). */
export function lzhufEncode(data) {
    const model = new Model();
    const w = new BitWriter();
    const pre = N - F;
    const buf = Buffer.alloc(pre + data.length, 0x20);
    buf.set(data, pre);
    const MAX_DIST = N - F;
    const HB = 14;
    const head = new Int32Array(1 << HB).fill(-1);
    const prev = new Int32Array(buf.length).fill(-1);
    const hash = (i) => ((buf[i] << 8) ^ (buf[i + 1] << 4) ^ buf[i + 2] ^ (buf[i] << 11)) & ((1 << HB) - 1);
    const insert = (i) => {
        if (i + 2 >= buf.length)
            return;
        const h = hash(i);
        prev[i] = head[h];
        head[h] = i;
    };
    const emitChar = (c) => {
        let k = model.prnt[c + T];
        const bits = [];
        do {
            bits.push(k & 1);
            k = model.prnt[k];
        } while (k !== R);
        for (let i = bits.length - 1; i >= 0; i--)
            w.put(bits[i], 1);
        model.update(c);
    };
    for (let i = 0; i < pre; i++)
        insert(i);
    let i = pre;
    while (i < buf.length) {
        let bestLen = 0, bestDist = 0;
        const maxLen = Math.min(F, buf.length - i);
        if (maxLen > THRESHOLD && i + 2 < buf.length) {
            let cand = head[hash(i)], depth = 64;
            while (cand >= 0 && depth-- > 0 && i - cand <= MAX_DIST) {
                let l = 0;
                while (l < maxLen && buf[cand + l] === buf[i + l])
                    l++;
                if (l > bestLen) {
                    bestLen = l;
                    bestDist = i - cand;
                    if (l === maxLen)
                        break;
                }
                cand = prev[cand];
            }
        }
        if (bestLen > THRESHOLD) {
            emitChar(255 - THRESHOLD + bestLen);
            const pos = bestDist - 1;
            const hi = pos >> 6;
            w.put(POS_CODE[hi], POS_LEN[hi]);
            w.put(pos & 63, 6);
            for (let k = 0; k < bestLen; k++)
                insert(i + k);
            i += bestLen;
        }
        else {
            emitChar(buf[i]);
            insert(i);
            i++;
        }
    }
    return w.finish();
}
