// LZO1X compressor (greedy, single-probe hash). Output is a valid LZO1X stream
// readable by any conforming decoder; ratio is modest by design.

const MAX_DIST = 0xbfff; // longest distance the longest opcode can express

type Seg = { litStart: number; litLen: number; matchLen: number; dist: number };

export function lzo1xCompress(src: Uint8Array): Buffer {
  const n = src.length;
  const HB = 16;
  const table = new Int32Array(1 << HB).fill(-1);
  const hash = (i: number) =>
    Math.imul(src[i] | (src[i + 1] << 8) | (src[i + 2] << 16) | (src[i + 3] << 24), 0x9e3779b1) >>> (32 - HB);

  const segs: Seg[] = [];
  let litStart = 0, i = 0;
  while (i + 4 <= n) {
    const h = hash(i);
    const cand = table[h];
    table[h] = i;
    if (cand >= 0 && i - cand <= MAX_DIST && src[cand] === src[i] && src[cand + 1] === src[i + 1] &&
        src[cand + 2] === src[i + 2] && src[cand + 3] === src[i + 3]) {
      let len = 4;
      while (i + len < n && src[cand + len] === src[i + len]) len++;
      segs.push({ litStart, litLen: i - litStart, matchLen: len, dist: i - cand });
      for (let k = 1; k < len && i + k + 4 <= n; k++) table[hash(i + k)] = i + k;
      i += len;
      litStart = i;
    } else i++;
  }
  segs.push({ litStart, litLen: n - litStart, matchLen: 0, dist: 0 });

  const out: number[] = [];
  const ext = (rem: number) => { while (rem > 255) { out.push(0); rem -= 255; } out.push(rem); };
  const lits = (start: number, len: number) => { for (let k = 0; k < len; k++) out.push(src[start + k]); };

  // A match cannot come first, so leading literals exist unless the input is empty.
  const first = segs[0];
  if (first.litLen > 0) {
    if (first.litLen <= 238) out.push(first.litLen + 17);
    else { out.push(0); ext(first.litLen - 18); }
    lits(first.litStart, first.litLen);
  }
  for (let s = 0; s < segs.length - 1; s++) {
    const { matchLen: len, dist } = segs[s];
    const next = segs[s + 1];
    const field = next.litLen <= 3 ? next.litLen : 0;
    if (len <= 8 && dist <= 2048) {
      out.push(((len - 1) << 5) | (((dist - 1) & 7) << 2) | field, (dist - 1) >> 3);
    } else if (dist <= 0x4000) {
      if (len - 2 <= 31) out.push(32 | (len - 2)); else { out.push(32); ext(len - 2 - 31); }
      const v = ((dist - 1) << 2) | field;
      out.push(v & 255, v >> 8);
    } else {
      const x = dist - 0x4000;
      const hi = x >= 0x4000 ? 8 : 0;
      const d = hi ? x - 0x4000 : x;
      if (len - 2 <= 7) out.push(16 | hi | (len - 2)); else { out.push(16 | hi); ext(len - 2 - 7); }
      const v = (d << 2) | field;
      out.push(v & 255, v >> 8);
    }
    if (next.litLen >= 1 && next.litLen <= 3) lits(next.litStart, next.litLen);
    else if (next.litLen >= 4) {
      if (next.litLen <= 18) out.push(next.litLen - 3); else { out.push(0); ext(next.litLen - 18); }
      lits(next.litStart, next.litLen);
    }
  }
  out.push(0x11, 0, 0);
  return Buffer.from(out);
}
