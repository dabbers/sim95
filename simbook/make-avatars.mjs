// make-avatars.mjs - draws SimBook's stock profile pictures: 16 little
// characters and 4 places (a beach, mountains, a sunset, a night), each 20
// by 20 squares, saved 4 times as big (80 by 80) as
// simbook/WEB/AV01.PIC ... AV20.PIC in SIM95's 16 colours. SimBook takes no
// uploaded pictures; every member gets one of these (picture.asp to change).
//   node simbook/make-avatars.mjs [preview.png]
// With a file name, it also writes a contact sheet of all 16 as a PNG.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const N = 20, SCALE = 4;
// SIM95's colours, by hex digit
const RGB = ["000000", "800000", "008000", "808000", "000080", "800080", "008080", "C0C0C0", "808080", "FF0000", "00FF00", "FFFF00", "0000FF", "FF00FF", "00FFFF", "FFFFFF"];
const [BLACK, MAROON, GREEN, OLIVE, NAVY, PURPLE, TEAL, SILVER, GREY, RED, LIME, YELLOW, BLUE, FUCHSIA, AQUA, WHITE] = [...Array(16).keys()];

function sprite(o) {
  const g = Array.from({ length: N }, () => Array(N).fill(o.bg ?? WHITE));
  const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < N && y < N) g[y][x] = c; };
  const rect = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, c); };
  const line = (cells, c) => cells.forEach(([x, y]) => set(x, y, c));
  const disc = (cx, cy, r, c) => { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) set(x, y, c); };
  if (o.scene) { scene(o.scene, { g, set, rect, line, disc }); return g; }
  const ink = o.bg === BLACK || o.bg === NAVY ? GREY : BLACK; // the outline, seen on any background
  // shoulders
  rect(4, 18, 15, 19, o.shirt);
  rect(6, 17, 13, 17, o.shirt);
  // the head: round, or square for a robot
  const inHead = (x, y) => (o.square ? x >= 5 && x <= 14 && y >= 5 && y <= 15 : (x - 9.5) ** 2 / 25 + (y - 10.5) ** 2 / 30 <= 1);
  // cat ears: triangles on top of the head, outlined with it
  const inEar = (x, y) => o.ears === "cat" && y >= 2 && y <= 6 && ((x >= 5 && x <= 5 + (y - 2)) || (x <= 14 && x >= 14 - (y - 2)));
  const inShape = (x, y) => inHead(x, y) || inEar(x, y);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (inShape(x, y)) set(x, y, o.skin);
    else if (inShape(x - 1, y) || inShape(x + 1, y) || inShape(x, y - 1) || inShape(x, y + 1)) set(x, y, ink);
  }
  if (o.ears === "cat") line([[6, 4], [6, 5], [13, 4], [13, 5]], FUCHSIA);
  // eyes
  const eye = o.eye ?? BLACK;
  if (o.cyclops) { rect(8, 8, 11, 10, WHITE); rect(9, 9, 10, 9, eye); }
  else if (o.visor) rect(6, 9, 13, 9, RED);
  else { set(7, 9, eye); set(12, 9, eye); if (o.big) { set(7, 10, eye); set(12, 10, eye); } }
  if (o.glasses) {
    // two frames with a lens each (white, the eye in it) and a bridge
    for (const x0 of [4, 11]) { rect(x0, 8, x0 + 4, 10, BLACK); rect(x0 + 1, 9, x0 + 3, 9, WHITE); }
    set(6, 9, BLACK); set(13, 9, BLACK);
    line([[9, 8], [10, 8]], BLACK);
  }
  if (o.shades) { rect(6, 8, 8, 9, BLACK); rect(11, 8, 13, 9, BLACK); line([[9, 8], [10, 8]], BLACK); set(6, 8, GREY); set(11, 8, GREY); }
  if (o.cheeks) { set(6, 11, o.cheeks); set(13, 11, o.cheeks); }
  // mouth
  const m = o.mouth;
  if (m === "smile") line([[7, 12], [8, 13], [9, 13], [10, 13], [11, 13], [12, 12]], BLACK);
  if (m === "grin") { rect(7, 12, 12, 13, BLACK); rect(8, 12, 11, 12, WHITE); }
  if (m === "o") { rect(9, 12, 10, 13, BLACK); }
  if (m === "flat") line([[8, 13], [9, 13], [10, 13], [11, 13]], BLACK);
  if (m === "teeth") { rect(7, 12, 12, 14, BLACK); line([[7, 12], [9, 12], [11, 12], [8, 14], [10, 14], [12, 14]], WHITE); }
  if (m === "smirk") line([[8, 13], [9, 13], [10, 13], [11, 12], [12, 12]], BLACK);
  // hair, hats and the rest
  const h = o.top, hc = o.topColour;
  if (h === "flat") { rect(5, 4, 14, 6, hc); set(5, 7, hc); set(14, 7, hc); }
  if (h === "spiky") { rect(5, 5, 14, 6, hc); line([[5, 4], [7, 3], [7, 4], [9, 2], [9, 3], [9, 4], [11, 3], [11, 4], [13, 4], [14, 4]], hc); }
  if (h === "cap") { rect(5, 3, 14, 6, hc); rect(13, 6, 17, 6, hc); set(9, 3, WHITE); }
  if (h === "long") { rect(5, 4, 14, 6, hc); rect(3, 6, 4, 16, hc); rect(15, 6, 16, 16, hc); }
  if (h === "bow") { rect(12, 3, 13, 5, hc); rect(15, 3, 16, 5, hc); rect(14, 4, 14, 4, hc); }
  if (h === "mohawk") { rect(9, 1, 10, 5, hc); }
  if (h === "party") { line([[9, 0], [10, 0], [8, 1], [9, 1], [10, 1], [11, 1], [8, 2], [9, 2], [10, 2], [11, 2], [7, 3], [8, 3], [9, 3], [10, 3], [11, 3], [12, 3], [7, 4], [12, 4]], hc); set(9, 2, WHITE); set(10, 0, WHITE); }
  if (h === "wizard") { for (let y = 0; y <= 5; y++) rect(9 - Math.floor(y / 2), y, 10 + Math.floor(y / 2), y, hc); rect(4, 5, 15, 5, hc); set(9, 2, YELLOW); set(10, 3, YELLOW); }
  if (h === "antennae") { line([[6, 3], [6, 4], [13, 3], [13, 4]], BLACK); set(6, 2, hc); set(13, 2, hc); }
  if (h === "phones") { rect(5, 3, 14, 3, BLACK); rect(3, 8, 4, 12, hc); rect(15, 8, 16, 12, hc); line([[4, 4], [4, 5], [4, 6], [4, 7], [15, 4], [15, 5], [15, 6], [15, 7]], BLACK); }
  if (h === "bolt") { set(9, 3, hc); set(10, 3, hc); rect(9, 2, 10, 2, GREY); }
  if (o.beard !== undefined) { for (let y = 12; y <= 16; y++) for (let x = 5; x <= 14; x++) if (inHead(x, y) && (y >= 13 || x <= 6 || x >= 13)) set(x, y, o.beard); line([[8, 13], [9, 13], [10, 13], [11, 13]], o.beard === BLACK ? GREY : BLACK); }
  if (o.whiskers) line([[3, 11], [4, 11], [3, 13], [4, 12], [15, 11], [16, 11], [15, 12], [16, 13]], BLACK);
  return g;
}

// Places rather than people, for whoever would rather not be a face.
function scene(name, { set, rect, line, disc }) {
  if (name === "beach") {
    rect(0, 0, 19, 10, AQUA);
    disc(15, 4, 2.3, YELLOW);
    line([[3, 3], [4, 3], [5, 3], [4, 2], [9, 5], [10, 5], [11, 5], [10, 4]], WHITE);
    rect(0, 11, 19, 13, BLUE);
    line([[2, 12], [3, 12], [8, 11], [9, 11], [14, 12], [15, 12], [18, 11]], WHITE);
    rect(0, 14, 19, 19, YELLOW);
    line([[0, 14], [1, 14], [6, 14], [7, 14], [12, 14], [17, 14], [18, 14]], WHITE);
    // a palm tree, leaning
    line([[4, 18], [4, 17], [5, 16], [5, 15], [5, 14], [6, 13], [6, 12], [6, 11], [7, 10], [7, 9]], OLIVE);
    line([[7, 8], [4, 7], [5, 7], [6, 7], [3, 8], [8, 7], [9, 7], [10, 8], [11, 9], [6, 6], [7, 5], [8, 6], [5, 9], [9, 6], [10, 6]], GREEN);
    line([[7, 9], [8, 9]], MAROON);
    // a beach ball
    disc(13, 17, 1.2, RED); set(13, 17, WHITE); set(12, 17, WHITE);
  }
  if (name === "mountains") {
    rect(0, 0, 19, 19, BLUE);
    rect(0, 0, 19, 4, AQUA);
    line([[2, 2], [3, 2], [4, 2], [3, 1], [13, 3], [14, 3], [15, 3], [14, 2]], WHITE);
    const peak = (cx, top, c) => { for (let y = top; y <= 15; y++) rect(cx - (y - top), y, cx + (y - top), y, c); };
    peak(6, 5, GREY); peak(14, 7, SILVER);
    line([[6, 5], [5, 6], [6, 6], [7, 6], [4, 7], [6, 7], [8, 7]], WHITE);
    line([[14, 7], [13, 8], [14, 8], [15, 8], [12, 9], [14, 9], [16, 9]], WHITE);
    rect(0, 15, 19, 19, GREEN);
    for (const x of [2, 9, 16]) { line([[x, 13], [x - 1, 14], [x, 14], [x + 1, 14], [x - 1, 15], [x, 15], [x + 1, 15]], GREEN); set(x, 16, MAROON); }
    rect(0, 18, 19, 19, OLIVE);
  }
  if (name === "sunset") {
    rect(0, 0, 19, 3, PURPLE); rect(0, 4, 19, 6, FUCHSIA); rect(0, 7, 19, 9, RED); rect(0, 10, 19, 11, YELLOW);
    disc(10, 11, 3.4, YELLOW);
    line([[3, 5], [4, 5], [5, 5], [14, 2], [15, 2], [16, 2], [17, 2]], PURPLE);
    rect(0, 12, 19, 19, NAVY);
    line([[8, 13], [9, 13], [10, 13], [11, 13], [12, 13], [9, 15], [10, 15], [11, 15], [10, 17], [7, 14], [13, 14]], YELLOW);
    line([[2, 16], [3, 16], [16, 18], [17, 18], [15, 15]], BLUE);
    // a boat
    rect(3, 13, 6, 13, BLACK); line([[4, 12], [5, 12], [5, 11], [5, 10], [4, 11]], BLACK);
  }
  if (name === "night") {
    rect(0, 0, 19, 19, NAVY);
    for (const [x, y] of [[2, 2], [7, 1], [11, 4], [17, 6], [4, 7], [9, 8], [15, 1], [1, 10], [13, 9]]) set(x, y, WHITE);
    for (const [x, y] of [[5, 4], [18, 3], [12, 1]]) set(x, y, YELLOW);
    disc(15, 4, 2.3, WHITE); disc(16, 3, 2.0, NAVY);
    // hills, and a little house with its light on
    for (let x = 0; x < N; x++) { const top = Math.round(13 + 2 * Math.sin(x / 3)); rect(x, top, x, 19, BLACK); }
    rect(0, 17, 19, 19, GREEN);
    rect(5, 12, 10, 16, MAROON); line([[4, 12], [5, 11], [6, 10], [7, 9], [8, 9], [9, 10], [10, 11], [11, 12]], RED); rect(6, 11, 9, 11, RED); rect(7, 10, 8, 10, RED);
    rect(6, 13, 7, 14, YELLOW); rect(9, 14, 9, 16, BLACK);
    line([[14, 15], [14, 16], [13, 16], [15, 16], [13, 14], [14, 14], [15, 14], [14, 13]], GREEN);
  }
}

export const avatars = [
  { bg: NAVY, skin: YELLOW, shirt: RED, top: "flat", topColour: MAROON, mouth: "smile" },
  { bg: TEAL, skin: WHITE, shirt: NAVY, top: "spiky", topColour: BLACK, mouth: "grin", cheeks: FUCHSIA },
  { bg: PURPLE, skin: YELLOW, shirt: GREEN, top: "cap", topColour: RED, mouth: "smile" },
  { bg: GREEN, skin: LIME, shirt: PURPLE, top: "antennae", topColour: FUCHSIA, mouth: "o", big: true },
  { bg: MAROON, skin: SILVER, shirt: GREY, top: "bolt", topColour: YELLOW, mouth: "flat", square: true, visor: true },
  { bg: OLIVE, skin: YELLOW, shirt: TEAL, top: "flat", topColour: BLACK, mouth: "smirk", glasses: true },
  { bg: BLUE, skin: AQUA, shirt: WHITE, top: "bow", topColour: FUCHSIA, mouth: "smile", big: true },
  { bg: GREY, skin: WHITE, shirt: MAROON, top: "flat", topColour: BLACK, beard: BLACK, mouth: "flat" },
  { bg: RED, skin: YELLOW, shirt: BLUE, top: "party", topColour: LIME, mouth: "grin" },
  { bg: AQUA, skin: YELLOW, shirt: BLACK, top: "phones", topColour: RED, mouth: "smile" },
  { bg: FUCHSIA, skin: WHITE, shirt: TEAL, top: "long", topColour: YELLOW, mouth: "smile", cheeks: RED },
  { bg: BLACK, skin: WHITE, shirt: RED, top: "mohawk", topColour: LIME, mouth: "smirk" },
  { bg: SILVER, skin: YELLOW, shirt: OLIVE, ears: "cat", whiskers: true, mouth: "o" },
  { bg: NAVY, skin: FUCHSIA, shirt: LIME, cyclops: true, eye: BLUE, mouth: "teeth" },
  { bg: TEAL, skin: WHITE, shirt: BLUE, top: "wizard", topColour: BLUE, beard: SILVER, mouth: "flat" },
  { bg: GREEN, skin: YELLOW, shirt: WHITE, top: "spiky", topColour: MAROON, shades: true, mouth: "smile" },
  { scene: "beach" },
  { scene: "mountains" },
  { scene: "sunset" },
  { scene: "night" },
];

const pic = (g) => `SIM95PIC ${N * SCALE} ${N * SCALE}\n` + g.flatMap((row) => Array(SCALE).fill(row.map((c) => c.toString(16).toUpperCase().repeat(SCALE)).join(""))).join("\n") + "\n";

// A PNG of rows of pixels (each an RGB hex string), for the contact sheet.
function png(width, height, at) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const rgb = at(x, y), o = y * (width * 3 + 1) + 1 + x * 3;
    raw[o] = parseInt(rgb.slice(0, 2), 16); raw[o + 1] = parseInt(rgb.slice(2, 4), 16); raw[o + 2] = parseInt(rgb.slice(4, 6), 16);
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const grids = avatars.map(sprite);
  grids.forEach((g, i) => fs.writeFileSync(path.join(here, "WEB", "AV" + String(i + 1).padStart(2, "0") + ".PIC"), pic(g)));
  console.log("wrote " + grids.length + " pictures to simbook/WEB/AV01.PIC ...");
  if (process.argv[2]) {
    const cell = N * SCALE * 2, gap = 12, cols = 5, rows = Math.ceil(grids.length / cols);
    const w = cols * (cell + gap) + gap, h = rows * (cell + gap) + gap;
    fs.writeFileSync(process.argv[2], png(w, h, (x, y) => {
      const cx = Math.floor((x - gap) / (cell + gap)), cy = Math.floor((y - gap) / (cell + gap));
      const ox = x - gap - cx * (cell + gap), oy = y - gap - cy * (cell + gap);
      const g = grids[cy * cols + cx];
      if (!g || ox < 0 || oy < 0 || ox >= cell || oy >= cell) return "C0C0C0";
      return RGB[g[Math.floor(oy / (SCALE * 2))][Math.floor(ox / (SCALE * 2))]];
    }));
    console.log("and a contact sheet: " + process.argv[2]);
  }
}
