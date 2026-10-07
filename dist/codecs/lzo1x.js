// LZO1X decompressor (pure TS, bounds-checked, growable output).
export class LzoError extends Error {
}
export function lzo1xDecompress(src, opts = {}) {
    const max = opts.maxOutput ?? 1 << 30;
    let out = Buffer.alloc(Math.min(Math.max(src.length * 4, 1 << 16), max));
    let op = 0, ip = 0;
    const n = src.length;
    const need = (k) => {
        if (op + k > out.length) {
            if (op + k > max)
                throw new LzoError("output overrun");
            const bigger = Buffer.alloc(Math.min(Math.max(out.length * 2, op + k), max));
            out.copy(bigger, 0, 0, op);
            out = bigger;
        }
    };
    const byte = () => {
        if (ip >= n)
            throw new LzoError("input overrun");
        return src[ip++];
    };
    const literals = (k) => {
        if (ip + k > n)
            throw new LzoError("input overrun");
        need(k);
        for (let i = 0; i < k; i++)
            out[op++] = src[ip++];
    };
    const run = (t, base) => {
        if (t === 0) {
            let z = 0;
            while (true) {
                const b = byte();
                if (b) {
                    t = z + base + b;
                    break;
                }
                z += 255;
            }
        }
        return t;
    };
    const copyMatch = (dist, len) => {
        if (dist < 1 || dist > op)
            throw new LzoError("lookbehind overrun");
        need(len);
        for (let i = 0, m = op - dist; i < len; i++)
            out[op++] = out[m++];
    };
    let t;
    let state = "loop";
    t = 0;
    if (n > 0 && src[0] > 17) {
        t = src[ip++] - 17;
        if (t < 4)
            state = "matchNext";
        else {
            literals(t);
            state = "firstLiteral";
        }
    }
    for (;;) {
        if (state === "loop") {
            t = byte();
            if (t >= 16)
                state = "match";
            else {
                literals(run(t, 15) + 3);
                state = "firstLiteral";
            }
        }
        if (state === "firstLiteral") {
            t = byte();
            if (t < 16) {
                const d = 1 + 0x0800 + (t >> 2) + (byte() << 2);
                copyMatch(d, 3);
                t = src[ip - 2] & 3;
                state = t === 0 ? "loop" : "matchNext";
                continue;
            }
            state = "match";
        }
        if (state === "matchNext") {
            literals(t);
            t = byte();
            state = "match";
        }
        // state === "match"
        let dist, len;
        if (t >= 64) {
            dist = 1 + ((t >> 2) & 7) + (byte() << 3);
            len = (t >> 5) - 1 + 2;
        }
        else if (t >= 32) {
            len = run(t & 31, 31) + 2;
            if (ip + 2 > n)
                throw new LzoError("input overrun");
            dist = 1 + ((src[ip] | (src[ip + 1] << 8)) >> 2);
            ip += 2;
        }
        else if (t >= 16) {
            const hi = (t & 8) << 11;
            len = run(t & 7, 7) + 2;
            if (ip + 2 > n)
                throw new LzoError("input overrun");
            const d = (src[ip] | (src[ip + 1] << 8)) >> 2;
            ip += 2;
            if (hi + d === 0) {
                if (ip !== n && !opts.allowTrailing)
                    throw new LzoError(ip < n ? "input not consumed" : "input overrun");
                return out.subarray(0, op);
            }
            dist = hi + d + 0x4000;
        }
        else {
            dist = 1 + (t >> 2) + (byte() << 2);
            len = 2;
        }
        copyMatch(dist, len);
        t = src[ip - 2] & 3;
        state = t === 0 ? "loop" : "matchNext";
    }
}
