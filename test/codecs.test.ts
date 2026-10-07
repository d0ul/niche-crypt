import test from "node:test";
import assert from "node:assert/strict";
import { lzo1xDecompress, LzoError, lzhufDecode } from "../src/index.ts";

test("lzo1x literal run + end marker", () => {
  const src = Buffer.concat([Buffer.from([5 + 17]), Buffer.from("hello"), Buffer.from([0x11, 0, 0])]);
  assert.equal(lzo1xDecompress(src).toString(), "hello");
});

test("lzo1x rejects truncated input and trailing data", () => {
  assert.throws(() => lzo1xDecompress(Buffer.from([30, 1, 2])), LzoError);
  const withTail = Buffer.concat([Buffer.from([5 + 17]), Buffer.from("hello"), Buffer.from([0x11, 0, 0, 9])]);
  assert.throws(() => lzo1xDecompress(withTail), LzoError);
  assert.equal(lzo1xDecompress(withTail, { allowTrailing: true }).toString(), "hello");
});

test("lzhuf zero-length output", () => {
  assert.equal(lzhufDecode(new Uint8Array(0), 0).length, 0);
});

import { lzo1xCompress, lzhufEncode } from "../src/index.ts";
import { randomBytes } from "node:crypto";

const samples: [string, Buffer][] = [
  ["empty", Buffer.alloc(0)],
  ["one byte", Buffer.from("a")],
  ["short text", Buffer.from("abcabcabcabcabcabc xyz")],
  ["zeros", Buffer.alloc(100000)],
  ["random", randomBytes(70000)],
  ["text", Buffer.from("the quick brown fox jumps over the lazy dog. ".repeat(4000))],
  ["mixed", Buffer.concat([randomBytes(300), Buffer.alloc(5000, 7), randomBytes(5), Buffer.from("hello hello hello hello"), randomBytes(60000), randomBytes(20000), Buffer.alloc(300, 1)])],
];

for (const [name, data] of samples) {
  test(`lzo1x round trip: ${name}`, () => {
    assert.deepEqual(lzo1xDecompress(lzo1xCompress(data)), data);
  });
  test(`lzhuf round trip: ${name}`, () => {
    assert.deepEqual(lzhufDecode(lzhufEncode(data), data.length), data);
  });
}
