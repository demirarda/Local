/**
 * Compact QR (byte mode, ECC L, versions 1–4). LOCAL-TAG gösterimi için.
 * Mask 0 + tabulated format bits — tarayıcılar geçerli formatı okur.
 */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

function gfMul(a, b) {
  if (!a || !b) return 0;
  return EXP[LOG[a] + LOG[b]];
}

function rsRemainder(data, ecLen) {
  const gen = new Uint8Array(ecLen + 1);
  gen[0] = 1;
  for (let i = 0; i < ecLen; i++) {
    const next = new Uint8Array(ecLen + 1);
    for (let j = 0; j < gen.length; j++) {
      next[j] ^= gfMul(gen[j], EXP[i]);
      if (j + 1 < next.length) next[j + 1] ^= gen[j];
    }
    gen.set(next);
  }
  const rest = new Uint8Array(ecLen);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ rest[0];
    rest.copyWithin(0, 1);
    rest[ecLen - 1] = 0;
    for (let j = 0; j < ecLen; j++) {
      rest[j] ^= gfMul(gen[j + 1], factor);
    }
  }
  return rest;
}

/** ECC-L: [version, size, dataCodewords, ecCodewords] */
const VERSIONS = [
  [1, 21, 19, 7],
  [2, 25, 34, 10],
  [3, 29, 55, 15],
  [4, 33, 80, 20],
];

const ALIGN = {
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
};

/** ECC L + mask 0 */
const FORMAT_L_MASK0 = 0x77c4;

function pickVersion(byteLen) {
  const bits = 4 + 8 + byteLen * 8 + 4;
  const need = Math.ceil(bits / 8);
  for (const row of VERSIONS) {
    if (need <= row[2]) return row;
  }
  throw new Error('QR payload too long');
}

function placeFinder(mod, ox, oy) {
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 7; x++) {
      const edge = x === 0 || x === 6 || y === 0 || y === 6;
      const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
      mod[oy + y][ox + x] = edge || core ? 1 : 0;
    }
  }
}

function reserved(size, version) {
  const r = Array.from({ length: size }, () => new Uint8Array(size));
  const mark = (x, y) => {
    if (x >= 0 && y >= 0 && x < size && y < size) r[y][x] = 1;
  };
  const block = (x0, y0, w, h) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) mark(x0 + x, y0 + y);
  };
  block(0, 0, 9, 9);
  block(size - 8, 0, 8, 9);
  block(0, size - 8, 9, 8);
  for (let i = 0; i < size; i++) {
    mark(i, 6);
    mark(6, i);
  }
  const pos = ALIGN[version] || [];
  for (const ay of pos) {
    for (const ax of pos) {
      if ((ax < 9 && ay < 9) || (ax > size - 10 && ay < 9) || (ax < 9 && ay > size - 10)) continue;
      block(ax - 2, ay - 2, 5, 5);
    }
  }
  return r;
}

function placeAlign(mod, version) {
  const size = mod.length;
  const pos = ALIGN[version] || [];
  for (const ay of pos) {
    for (const ax of pos) {
      if ((ax < 9 && ay < 9) || (ax > size - 10 && ay < 9) || (ax < 9 && ay > size - 10)) continue;
      for (let y = -2; y <= 2; y++) {
        for (let x = -2; x <= 2; x++) {
          const edge = Math.abs(x) === 2 || Math.abs(y) === 2;
          mod[ay + y][ax + x] = edge || (x === 0 && y === 0) ? 1 : 0;
        }
      }
    }
  }
}

function placeFormat(mod) {
  const size = mod.length;
  const bits = FORMAT_L_MASK0;
  for (let i = 0; i < 15; i++) {
    const bit = (bits >> (14 - i)) & 1;
    if (i < 6) mod[i][8] = bit;
    else if (i < 8) mod[i + 1][8] = bit;
    else mod[size - 15 + i][8] = bit;

    if (i < 8) mod[8][size - 1 - i] = bit;
    else if (i < 9) mod[8][15 - i] = bit;
    else mod[8][14 - i] = bit;
  }
  mod[size - 8][8] = 1;
}

function mask0(x, y) {
  return (x + y) % 2 === 0;
}

/**
 * @param {string} text
 * @returns {number[][]} 1 = dark module
 */
export function buildQrModules(text) {
  const bytes = Array.from(new TextEncoder().encode(String(text || '')));
  const [version, size, dataCw, ecCw] = pickVersion(bytes.length);

  const bits = [];
  const push = (val, n) => {
    for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, 8);
  for (const b of bytes) push(b, 8);
  push(0, 4);
  while (bits.length % 8 !== 0) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
    data.push(v);
  }
  const pads = [0xec, 0x11];
  let p = 0;
  while (data.length < dataCw) data.push(pads[p++ % 2]);
  const ec = rsRemainder(Uint8Array.from(data), ecCw);
  const code = Uint8Array.from([...data, ...ec]);

  const mod = Array.from({ length: size }, () => new Uint8Array(size));
  const res = reserved(size, version);
  placeFinder(mod, 0, 0);
  placeFinder(mod, size - 7, 0);
  placeFinder(mod, 0, size - 7);
  for (let i = 8; i < size - 8; i++) {
    mod[6][i] = i % 2 === 0 ? 1 : 0;
    mod[i][6] = i % 2 === 0 ? 1 : 0;
  }
  placeAlign(mod, version);
  placeFormat(mod);

  let bitIdx = 0;
  const totalBits = code.length * 8;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col = 5;
    for (let n = 0; n < size; n++) {
      const y = Math.floor(col / 2) % 2 === 0 ? size - 1 - n : n;
      for (let dx = 0; dx < 2; dx++) {
        const x = col - dx;
        if (res[y][x]) continue;
        let bit = 0;
        if (bitIdx < totalBits) {
          bit = (code[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1;
          bitIdx += 1;
        }
        if (mask0(x, y)) bit ^= 1;
        mod[y][x] = bit;
      }
    }
  }
  placeFormat(mod);
  return mod.map((row) => Array.from(row));
}

export function qrSizeFor(text) {
  return pickVersion(Array.from(new TextEncoder().encode(String(text || ''))).length)[1];
}
