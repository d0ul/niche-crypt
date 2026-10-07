import test from "node:test";
import assert from "node:assert/strict";
import { Blowfish } from "../src/ciphers/blowfish.ts";
import { Seed, SeedCbc } from "../src/ciphers/seed.ts";
import { Hight } from "../src/ciphers/hight.ts";

const h = (s: string) => Uint8Array.from(Buffer.from(s, "hex"));
const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");

test("blowfish known answers", () => {
  const cases: [string, string, string][] = [
    ["0000000000000000", "0000000000000000", "4ef997456198dd78"],
    ["ffffffffffffffff", "ffffffffffffffff", "51866fd5b85ecb8a"],
    ["3000000000000000", "1000000000000001", "7d856f9a613063f2"],
  ];
  for (const [k, p, c] of cases) {
    const bf = new Blowfish(h(k));
    const b = h(p);
    bf.encryptBlock(b);
    assert.equal(hex(b), c);
    bf.decryptBlock(b);
    assert.equal(hex(b), p);
  }
});

test("seed known answer (RFC 4269)", () => {
  const s = new Seed(new Uint8Array(16));
  const b = h("000102030405060708090a0b0c0d0e0f");
  s.encryptBlock(b);
  assert.equal(hex(b), "5ebac6e0054e166819aff1cc6d346cdb");
  s.decryptBlock(b);
  assert.equal(hex(b), "000102030405060708090a0b0c0d0e0f");
});

test("seed cbc round trip, chained across calls", () => {
  const key = h("00112233445566778899aabbccddeeff"), iv = h("ffeeddccbbaa99887766554433221100");
  const pt = Buffer.from(Array.from({ length: 64 }, (_, i) => i * 7));
  const ct = new SeedCbc(key, iv).encrypt(pt);
  const d = new SeedCbc(key, iv);
  assert.deepEqual(Buffer.concat([d.decrypt(ct.subarray(0, 32)), d.decrypt(ct.subarray(32))]), pt);
});

test("hight known answers", () => {
  const v = [
    ["00112233445566778899aabbccddeeff", "0000000000000000", "00f418aed94f03f2"],
    ["ffeeddccbbaa99887766554433221100", "0011223344556677", "23ce9f72e543e6d8"],
    ["000102030405060708090a0b0c0d0e0f", "0123456789abcdef", "7a6fb2a28d23f466"],
    ["28dbc3bc49ffd87dcfa509b11d422be7", "b41e6be2eba84a14", "cc047a75209c1fc6"],
  ];
  for (const native of [false, true]) {
    for (const [k, p, c] of v) {
      const x = new Hight(h(k), native);
      const b = h(p);
      x.encryptBlock(b);
      if (!native) assert.equal(hex(b), c);
      x.decryptBlock(b);
      assert.equal(hex(b), p);
    }
  }
});

import { cbc, pkcs7Pad, pkcs7Unpad } from "../src/index.ts";

test("cbc + pkcs7 round trip for 8-byte ciphers", () => {
  const iv = h("0001020304050607");
  const msg = Buffer.from("not a multiple of eight!");
  for (const c of [new Blowfish(h("00112233")), new Hight(h("000102030405060708090a0b0c0d0e0f"))]) {
    const ct = cbc(c, iv, pkcs7Pad(msg, 8), "encrypt");
    assert.deepEqual(pkcs7Unpad(cbc(c, iv, ct, "decrypt"), 8), msg);
  }
});
