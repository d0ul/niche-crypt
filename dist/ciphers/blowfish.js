// Blowfish (ECB, single-block). Constants are derived from the hex digits of
// pi at first use, so no big tables are embedded.
let initP;
let initS;
function arctanInv(x, one) {
    const x2 = x * x;
    let term = one / x;
    let sum = term;
    for (let n = 1n; term !== 0n; n++) {
        term /= x2;
        const t = term / (2n * n + 1n);
        sum += n % 2n ? -t : t;
    }
    return sum;
}
function loadPi() {
    if (initP)
        return;
    const words = 18 + 4 * 256;
    const bits = BigInt(words * 32 + 64);
    const one = 1n << bits;
    const pi = 16n * arctanInv(5n, one) - 4n * arctanInv(239n, one);
    const frac = pi - 3n * one;
    const all = new Uint32Array(words);
    for (let i = 0; i < words; i++) {
        all[i] = Number((frac >> (bits - BigInt(32 * (i + 1)))) & 0xffffffffn);
    }
    initP = all.slice(0, 18);
    initS = all.slice(18);
}
export class Blowfish {
    P = new Uint32Array(18);
    S = new Uint32Array(1024);
    constructor(key) {
        if (key.length < 1 || key.length > 56)
            throw new RangeError("Blowfish key must be 1..56 bytes");
        loadPi();
        this.P.set(initP);
        this.S.set(initS);
        for (let i = 0, k = 0; i < 18; i++) {
            let w = 0;
            for (let j = 0; j < 4; j++)
                w = ((w << 8) | key[k++ % key.length]) >>> 0;
            this.P[i] = (this.P[i] ^ w) >>> 0;
        }
        let l = 0, r = 0;
        for (let i = 0; i < 18; i += 2) {
            [l, r] = this.encryptWords(l, r);
            this.P[i] = l;
            this.P[i + 1] = r;
        }
        for (let i = 0; i < 1024; i += 2) {
            [l, r] = this.encryptWords(l, r);
            this.S[i] = l;
            this.S[i + 1] = r;
        }
    }
    f(x) {
        const S = this.S;
        return ((((S[x >>> 24] + S[256 + ((x >>> 16) & 255)]) >>> 0) ^ S[512 + ((x >>> 8) & 255)]) + S[768 + (x & 255)]) >>> 0;
    }
    encryptWords(l, r) {
        const P = this.P;
        l = (l ^ P[0]) >>> 0;
        for (let i = 1; i <= 16; i += 2) {
            r = (r ^ this.f(l) ^ P[i]) >>> 0;
            l = (l ^ this.f(r) ^ P[i + 1]) >>> 0;
        }
        return [(r ^ P[17]) >>> 0, l];
    }
    decryptWords(l, r) {
        const P = this.P;
        l = (l ^ P[17]) >>> 0;
        for (let i = 16; i >= 1; i -= 2) {
            r = (r ^ this.f(l) ^ P[i]) >>> 0;
            l = (l ^ this.f(r) ^ P[i - 1]) >>> 0;
        }
        return [(r ^ P[0]) >>> 0, l];
    }
    /** Big-endian 8-byte block, in place. */
    decryptBlock(buf, off = 0) { this.run(buf, off, false); }
    encryptBlock(buf, off = 0) { this.run(buf, off, true); }
    run(b, o, enc) {
        const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
        const [l, r] = (enc ? this.encryptWords : this.decryptWords).call(this, dv.getUint32(o), dv.getUint32(o + 4));
        dv.setUint32(o, l);
        dv.setUint32(o + 4, r);
    }
}
