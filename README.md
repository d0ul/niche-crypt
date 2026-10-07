# niche-crypt

Obscure ciphers and codecs for Node.js, in pure TypeScript. Everything works in both directions: encrypt and decrypt, compress and decompress.

Blowfish, SEED, HIGHT, LZO1X and LZHUF turn up constantly when you work with old firmware, embedded devices, regional software and archived file formats. Modern runtimes have dropped most of them. OpenSSL 3 moved Blowfish and SEED into its legacy provider, so `crypto.createDecipheriv("seed-cbc", ...)` throws `error:0308010C:digital envelope routines::unsupported` on current Node. `niche-crypt` brings them back as one small package with no native addons, no build step for consumers, and no flags.

## Why use it

- **Works on current Node.** No `--openssl-legacy-provider`, no OpenSSL rebuild.
- **Zero dependencies.** Plain TypeScript, ships with type declarations.
- **Verified.** Every cipher is tested against its published known-answer vectors, and the codecs are checked against real-world data.
- **Small and explicit.** Keys, IVs and container layouts are your business. The library only does the math, so there are no hidden defaults to trip over.

## Install

```sh
npm install niche-crypt
```

Requires Node 22.6 or newer.

## What is included

| Export | Description |
| --- | --- |
| `Blowfish` | 1 to 56 byte key, big-endian 8-byte blocks |
| `Seed` | 128-bit block cipher (RFC 4269) |
| `SeedCbc` | Stateful CBC helper for SEED, no padding, chainable across calls |
| `Hight` | 64-bit lightweight block cipher (KS X 1213) |
| `lzo1xDecompress`, `lzo1xCompress` | LZO1X decoder (bounds checked, growable output) and a fast greedy compressor |
| `lzhufDecode`, `lzhufEncode` | LZHUF (LZSS with adaptive Huffman), both directions |
| `ecb`, `cbc` | Whole-buffer helpers for the 8-byte-block ciphers, both directions |
| `pkcs7Pad`, `pkcs7Unpad` | Optional padding helpers |

## Usage

### Blowfish

```ts
import { Blowfish, ecb } from "niche-crypt";

const bf = new Blowfish(Buffer.from("secret"));
const plain = ecb(bf, cipherBytes, "decrypt"); // length must be a multiple of 8
```

Single blocks can be processed in place with `bf.decryptBlock(buf, offset)`.

### Encrypting

Every cipher has `encryptBlock` as well as `decryptBlock`, and the helpers take a direction:

```ts
import { Blowfish, Hight, cbc, pkcs7Pad, pkcs7Unpad } from "niche-crypt";

const c = new Hight(key16);
const ct = cbc(c, iv8, pkcs7Pad(message, 8), "encrypt");
const pt = pkcs7Unpad(cbc(c, iv8, ct, "decrypt"), 8);
```

`SeedCbc` has a matching `encrypt` method. Padding is never applied implicitly.

### SEED in CBC mode

```ts
import { SeedCbc } from "niche-crypt";

const cbc = new SeedCbc(key16, iv16);
const a = cbc.decrypt(firstChunk);  // multiples of 16 bytes
const b = cbc.decrypt(secondChunk); // chaining continues automatically
```

Because the IV state carries over between calls, large files can be decrypted chunk by chunk without loading them whole. Padding is never applied or removed, so you decide how to treat the tail.

### HIGHT

```ts
import { Hight, ecb } from "niche-crypt";

const spec = new Hight(key16);        // byte order as printed in the specification
const raw = new Hight(key16, true);   // raw index order, as many embedded implementations use
```

If output looks like noise with one setting, try the other. Both modes pass round-trip tests, and the specification mode matches the official test vectors.

### LZO1X

```ts
import { lzo1xCompress, lzo1xDecompress } from "niche-crypt";

const packed = lzo1xCompress(data);

const out = lzo1xDecompress(compressed);
const lenient = lzo1xDecompress(compressed, { allowTrailing: true, maxOutput: 64 << 20 });
```

By default the input must be consumed exactly. Set `allowTrailing` when the stream is followed by padding or a checksum, and `maxOutput` to cap memory on untrusted data. Malformed input throws `LzoError`.

### LZHUF

```ts
import { lzhufDecode, lzhufEncode } from "niche-crypt";

const payload = lzhufEncode(data); // raw stream, no length header: store data.length yourself
const out = lzhufDecode(payload, expectedLength);
```

The expected output length comes from whatever header your container uses.

The compressors favor simplicity over ratio. Their output is valid for any conforming decoder: LZO1X streams were checked against the reference C library, and LZHUF streams against an independent decoder.

## Design notes

- Blowfish constants are computed from the digits of pi when first needed, which keeps the package small.
- Decoders are written defensively: every read and every back-reference is bounds checked.
- Nothing here is meant for protecting new data. These algorithms are included so that existing data stays readable.

## Development

```sh
npm install
npm run build
npm test
```

## License

**LEAF License**: Refer LICENSE for detailed information.
