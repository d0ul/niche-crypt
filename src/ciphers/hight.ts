// HIGHT 64-bit block cipher (KS X 1213 / ISO/IEC 18033-3).
// `native: true` indexes key/block bytes without the spec's reversed display
// convention (as some embedded implementations do).

const rotl8 = (x: number, r: number) => ((x << r) | (x >>> (8 - r))) & 255;
const F0 = (x: number) => rotl8(x, 1) ^ rotl8(x, 2) ^ rotl8(x, 7);
const F1 = (x: number) => rotl8(x, 3) ^ rotl8(x, 4) ^ rotl8(x, 6);

const DELTA = (() => {
  const s = new Array<number>(134).fill(0);
  [0, 1, 0, 1, 1, 0, 1].forEach((v, i) => (s[i] = v));
  for (let i = 1; i < 128; i++) s[i + 6] = s[i + 2] ^ s[i - 1];
  return Array.from({ length: 128 }, (_, i) => {
    let v = 0;
    for (let b = 0; b < 7; b++) v |= s[i + b] << b;
    return v;
  });
})();

export class Hight {
  private readonly WK = new Uint8Array(8);
  private readonly SK = new Uint8Array(128);

  private readonly native: boolean;

  constructor(key: Uint8Array, native = false) {
    this.native = native;
    if (key.length !== 16) throw new RangeError("HIGHT key must be 16 bytes");
    const K = native ? Array.from(key) : Array.from(key).reverse();
    for (let i = 0; i < 4; i++) this.WK[i] = K[i + 12];
    for (let i = 4; i < 8; i++) this.WK[i] = K[i - 4];
    const m8 = (n: number) => ((n % 8) + 8) % 8;
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        this.SK[16 * i + j] = (K[m8(j - i)] + DELTA[16 * i + j]) & 255;
        this.SK[16 * i + j + 8] = (K[m8(j - i) + 8] + DELTA[16 * i + j + 8]) & 255;
      }
    }
  }

  private load(b: Uint8Array, o: number): number[] {
    const x = Array.from(b.subarray(o, o + 8));
    return this.native ? x : x.reverse();
  }
  private store(x: number[], b: Uint8Array, o: number): void {
    (this.native ? x : [...x].reverse()).forEach((v, i) => (b[o + i] = v));
  }

  encryptBlock(b: Uint8Array, o = 0): void {
    const { WK, SK } = this;
    const p = this.load(b, o);
    let x = [(p[0] + WK[0]) & 255, p[1], p[2] ^ WK[1], p[3], (p[4] + WK[2]) & 255, p[5], p[6] ^ WK[3], p[7]];
    for (let i = 0; i < 32; i++) {
      if (i === 31) {
        x = [x[0], (x[1] + (F1(x[0]) ^ SK[124])) & 255, x[2], x[3] ^ ((F0(x[2]) + SK[125]) & 255),
             x[4], (x[5] + (F1(x[4]) ^ SK[126])) & 255, x[6], x[7] ^ ((F0(x[6]) + SK[127]) & 255)];
        break;
      }
      x = [x[7] ^ ((F0(x[6]) + SK[4 * i + 3]) & 255), x[0], (x[1] + (F1(x[0]) ^ SK[4 * i])) & 255, x[2],
           x[3] ^ ((F0(x[2]) + SK[4 * i + 1]) & 255), x[4], (x[5] + (F1(x[4]) ^ SK[4 * i + 2])) & 255, x[6]];
    }
    this.store([(x[0] + WK[4]) & 255, x[1], x[2] ^ WK[5], x[3], (x[4] + WK[6]) & 255, x[5], x[6] ^ WK[7], x[7]], b, o);
  }

  decryptBlock(b: Uint8Array, o = 0): void {
    const { WK, SK } = this;
    const c = this.load(b, o);
    let x = [(c[0] - WK[4]) & 255, c[1], c[2] ^ WK[5], c[3], (c[4] - WK[6]) & 255, c[5], c[6] ^ WK[7], c[7]];
    x = [x[0], (x[1] - (F1(x[0]) ^ SK[124])) & 255, x[2], x[3] ^ ((F0(x[2]) + SK[125]) & 255),
         x[4], (x[5] - (F1(x[4]) ^ SK[126])) & 255, x[6], x[7] ^ ((F0(x[6]) + SK[127]) & 255)];
    for (let i = 30; i >= 0; i--) {
      const cur = new Array<number>(8);
      cur[0] = x[1]; cur[2] = x[3]; cur[4] = x[5]; cur[6] = x[7];
      cur[7] = x[0] ^ ((F0(cur[6]) + SK[4 * i + 3]) & 255);
      cur[1] = (x[2] - (F1(cur[0]) ^ SK[4 * i])) & 255;
      cur[3] = x[4] ^ ((F0(cur[2]) + SK[4 * i + 1]) & 255);
      cur[5] = (x[6] - (F1(cur[4]) ^ SK[4 * i + 2])) & 255;
      x = cur;
    }
    this.store([(x[0] - WK[0]) & 255, x[1], x[2] ^ WK[1], x[3], (x[4] - WK[2]) & 255, x[5], x[6] ^ WK[3], x[7]], b, o);
  }
}
