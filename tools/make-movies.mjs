// Makes SimTube's sample movies (simtube/MOVIES/*.SMV), and knows the SimMovie
// format well enough for the tests to check SimPlayer against it.
//   node tools/make-movies.mjs
//
// A SimMovie (.SMV) is plain text. A header, a line holding just ".", then one
// line per frame (see simtube/README.md for the whole format):
//   SIMMOVIE 1
//   title=Bouncing S
//   width=160
//   ...
//   .
//   *C12;D40,40,10          a keyframe: starts from a blank screen
//   C15;F30,30,21,21;...    a delta: drawn over the frame before
//   -                       nothing changes
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PART = 15000;

// ---------------------------------------------------------------- building

export class Movie {
  constructor(meta) {
    this.meta = { author: "SimTube", fps: 10, bg: 15, ...meta };
    this.lines = [];
    this.frames = 0;
  }
  // a picture, drawn later with I x,y,name: rows of hex digits, one per pixel
  pic(name, rows) { this.lines.push("!" + name + "|SIM95PIC " + rows[0].length + " " + rows.length + "|" + rows.join("|")); }
  frame(cmds, key = false) {
    const body = cmds.filter(Boolean).join(";");
    this.lines.push((key ? "*" : "") + (body || (key ? "" : "-")));
    this.frames++;
  }
  hold(n) { for (let i = 0; i < n; i++) this.frame([]); }
  toString() {
    const m = { ...this.meta, frames: this.frames };
    const head = ["SIMMOVIE 1", ...["title", "author", "width", "height", "fps", "frames", "bg", "thumb", "about"].filter((k) => m[k] !== undefined).map((k) => k + "=" + m[k]), "."];
    return head.concat(this.lines).join("\n") + "\n";
  }
}

// ---------------------------------------------------------------- reading

export function parse(text) {
  const lines = text.replace(/\r/g, "").split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  if (!/^SIMMOVIE 1/.test(lines[0])) throw new Error("not a SimMovie");
  const meta = {};
  let i = 1;
  for (; i < lines.length && lines[i] !== "."; i++) { const at = lines[i].indexOf("="); if (at > 0) meta[lines[i].slice(0, at)] = lines[i].slice(at + 1); }
  const frames = [];
  const pics = {};
  for (i++; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith("!")) { const p = l.slice(1).split("|"); pics[p[0]] = p.slice(1).join("\n"); }
    else if (l.startsWith("'") || l === "") continue;
    else frames.push(l);
  }
  return { meta, frames, pics };
}

// The canvas methods SimPlayer calls to draw one frame over the one before.
export function calls(frame) {
  const out = [];
  let line = frame;
  if (line.startsWith("*")) { out.push("Clear", "SetColor"); line = line.slice(1); }
  if (line === "-" || line === "") return out;
  for (const c of line.split(";")) {
    const op = c[0];
    const n = c.slice(1).split(",").length;
    const each = { X: "Clear", C: "SetColor", R: "Rect", F: "FillRect", O: "Circle", D: "FillCircle", T: "Text", I: "Picture" }[op];
    if (each) out.push(each);
    else if (op === "L") for (let k = 0; k < n / 2 - 1; k++) out.push("Line");
    else if (op === "P") for (let k = 0; k < n / 2; k++) out.push("Line");
    else if (op === "Q") for (let k = 0; k < scanlines(c.slice(1).split(",").map(Number)); k++) out.push("Line");
  }
  return out;
}

// How many lines SimPlayer draws to fill a polygon: for each row from top to
// bottom, one between each pair of edges it crosses.
function scanlines(p) {
  const k = Math.floor(p.length / 2);
  const ys = Array.from({ length: k }, (_, i) => p[i * 2 + 1]);
  let n = 0;
  for (let y = Math.min(...ys); y <= Math.max(...ys); y++) {
    let crossings = 0;
    for (let i = 0; i < k; i++) {
      const y1 = ys[i], y2 = ys[(i + 1) % k];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) crossings++;
    }
    n += Math.floor(crossings / 2);
  }
  return n;
}

// Cuts a movie into parts of at most PART characters, a whole line at a time,
// and the manifest that lists them (part URLs relative to the manifest).
export function cut(text, name = "PART") {
  const parts = [];
  let cur = "";
  for (const line of text.replace(/\r/g, "").replace(/\n$/, "").split("\n")) {
    if (cur.length + line.length + 1 > PART && cur) { parts.push(cur); cur = ""; }
    cur += line + "\n";
  }
  if (cur) parts.push(cur);
  return parts;
}

// ---------------------------------------------------------------- drawing helpers

const cmd = {
  color: (c) => "C" + c,
  fill: (x, y, w, h) => `F${x | 0},${y | 0},${w | 0},${h | 0}`,
  rect: (x, y, w, h) => `R${x | 0},${y | 0},${w | 0},${h | 0}`,
  disc: (x, y, r) => `D${x | 0},${y | 0},${r | 0}`,
  circle: (x, y, r) => `O${x | 0},${y | 0},${r | 0}`,
  line: (...p) => "L" + p.map((v) => v | 0).join(","),
  poly: (...p) => "P" + p.map((v) => v | 0).join(","),
  solid: (...p) => "Q" + p.map((v) => v | 0).join(","),
  text: (x, y, s) => `T${x | 0},${y | 0},${s.replace(/;/g, ",")}`,
  pic: (x, y, name) => `I${x | 0},${y | 0},${name}`,
  beep: (f, ms) => `S${f | 0},${ms | 0}`,
};
const hex = "0123456789ABCDEF";

// The S logo: a red box with rounded corners and a white S, 24 by 24.
function logoRows(back = 15) {
  const rows = [];
  for (let y = 0; y < 24; y++) {
    let r = "";
    for (let x = 0; x < 24; x++) {
      const corner = (x < 2 || x > 21) && (y < 2 || y > 21) && !((x === 1 || x === 22) && (y === 1 || y === 22));
      let c = corner ? back : 9;
      const inS = (y >= 4 && y <= 6 && x >= 6 && x <= 18) || (y >= 7 && y <= 10 && x >= 5 && x <= 8) || (y >= 11 && y <= 13 && x >= 6 && x <= 17)
        || (y >= 14 && y <= 17 && x >= 15 && x <= 18) || (y >= 18 && y <= 20 && x >= 5 && x <= 17);
      if (inS) c = 15;
      if (!corner && (x === 0 || x === 23 || y === 0 || y === 23)) c = 1;
      r += hex[c];
    }
    rows.push(r);
  }
  return rows;
}

// ---------------------------------------------------------------- the samples

// Welcome to SimTube: the S logo bounces round the screen like a screen saver,
// and beeps in the corners.
function welcome() {
  const W = 160, H = 120, S = 24;
  const m = new Movie({ title: "Welcome to SimTube", about: "The S logo bounces round the screen. Will it hit the corner?", width: W, height: H, fps: 10, bg: 0, thumb: 25 });
  m.pic("logo", logoRows(0));
  let x = 10, y = 10, dx = 6, dy = 4, ox = x, oy = y;
  const top = 0, bottom = H - 22 - S;
  const words = ["WELCOME", "TO", "SIMTUBE!"];
  for (let f = 0; f < 90; f++) {
    const key = f % 30 === 0;
    const c = [];
    if (key) c.push(cmd.color(1), cmd.fill(0, H - 20, W, 20), cmd.color(7), cmd.line(0, H - 21, W - 1, H - 21));
    else c.push(cmd.color(0), cmd.fill(ox, oy, S, S));
    // the caption flashes a word at a time
    if (f % 10 === 0 || key) {
      const word = words.slice(0, (Math.floor(f / 10) % 4)).join(" ");
      c.push(cmd.color(1), cmd.fill(1, H - 19, W - 2, 18), cmd.color(f % 20 < 10 ? 11 : 14), cmd.text(8, H - 16, word || "SimTube presents..."));
    }
    c.push(cmd.pic(x, y, "logo"));
    let hits = 0;
    ox = x; oy = y;
    x += dx; y += dy;
    if (x < 0 || x > W - S) { dx = -dx; x = Math.max(0, Math.min(W - S, x)); hits++; }
    if (y < top || y > bottom) { dy = -dy; y = Math.max(top, Math.min(bottom, y)); hits++; }
    if (hits) c.push(cmd.beep(hits > 1 ? 1320 : 440 + 110 * (f % 4), 40));
    m.frame(c, key);
  }
  return m;
}

// The dancing baby: a stick figure doing the cha-cha on a disco floor,
// with a beeping ooga-chaka.
function dance() {
  const W = 160, H = 120;
  const m = new Movie({ title: "Dancing Baby", about: "Ooga chaka, ooga ooga. The internet's first dance craze, now in 16 colours.", width: W, height: H, fps: 10, bg: 0, thumb: 12 });
  const floor = (beat) => {
    const c = [];
    for (let i = 0; i < 8; i++) for (let j = 0; j < 1; j++) {
      const col = [9, 10, 12, 13, 14, 11][(i + j * 3 + beat) % 6];
      c.push(cmd.color(col), cmd.fill(i * 20, 96, 19, 23));
    }
    return c;
  };
  const tune = [523, 0, 392, 0, 523, 523, 392, 0, 440, 0, 349, 0, 440, 440, 349, 0];
  const lights = (beat) => [cmd.color([12, 13, 14, 10][beat % 4]), cmd.disc(20, 12, 6), cmd.color([10, 12, 13, 14][beat % 4]), cmd.disc(140, 12, 6)];
  for (let f = 0; f < 240; f++) {
    const key = f % 20 === 0;
    const t = f / 10 * Math.PI;
    const sway = Math.sin(t) * 10, bob = Math.abs(Math.sin(t)) * 4;
    const cx = 80 + sway, hip = 70 - bob, neck = 46 - bob;
    const arm = Math.sin(t * 2) * 12, leg = Math.sin(t) * 8;
    const c = [];
    if (key) c.push(cmd.color(5), cmd.fill(0, 0, W, 4));
    else c.push(cmd.color(0), cmd.fill(48, 20, 64, 76));
    if (key || f % 5 === 0) c.push(...floor(Math.floor(f / 5)), ...lights(Math.floor(f / 5)));
    // head, nappy, body, arms, legs
    c.push(cmd.color(14), cmd.disc(cx, neck - 9, 8), cmd.color(0), cmd.disc(cx - 3, neck - 11, 1), cmd.disc(cx + 3, neck - 11, 1), cmd.line(cx - 3, neck - 6, cx, neck - 5, cx + 3, neck - 6));
    c.push(cmd.color(14), cmd.line(cx, neck, cx, hip - 6));
    c.push(cmd.color(15), cmd.solid(cx - 7, hip - 8, cx + 7, hip - 8, cx + 5, hip, cx - 5, hip));
    c.push(cmd.color(14), cmd.line(cx - 16, neck + 2 - arm, cx - 8, neck + 8, cx, neck + 3, cx + 8, neck + 8, cx + 16, neck + 2 + arm));
    c.push(cmd.line(cx - 12 - leg, 94, cx - 6, hip + 10, cx - 3, hip), cmd.line(cx + 3, hip, cx + 6, hip + 10, cx + 12 - leg, 94));
    if (tune[f % 16] && f % 2 === 0) c.push(cmd.beep(tune[f % 16], 60));
    m.frame(c, key);
  }
  return m;
}

// All your base: the title cards, typed out a letter at a time.
function base() {
  const W = 200, H = 120;
  const m = new Movie({ title: "All Your Base", about: "In A.D. 2101, war was beginning. A faithful translation of the arcade classic.", width: W, height: H, fps: 10, bg: 0, thumb: 160 });
  const cards = [
    ["In A.D. 2101", "War was beginning."],
    ["Captain: What happen?"],
    ["Mechanic: Somebody set", "up us the bomb."],
    ["Operator: We get signal."],
    ["Captain: What!"],
    ["Operator: Main screen", "turn on."],
    ["CATS: How are you", "gentlemen !!"],
    ["CATS: All your base", "are belong to us."],
    ["CATS: You are on the way", "to destruction."],
    ["Captain: Take off every", "'ZIG' !!"],
    ["Captain: For great justice."],
  ];
  const cats = [cmd.color(8), cmd.solid(70, 30, 130, 30, 120, 70, 80, 70), cmd.color(7), cmd.solid(85, 40, 115, 40, 108, 62, 92, 62), cmd.color(12), cmd.disc(92, 48, 3), cmd.disc(108, 48, 3), cmd.color(0), cmd.line(94, 56, 100, 58, 106, 56)];
  const ship = [cmd.color(7), cmd.solid(100, 30, 130, 60, 100, 52, 70, 60), cmd.color(12), cmd.fill(97, 52, 7, 8)];
  for (const [n, card] of cards.entries()) {
    const art = /CATS/.test(card[0]) ? cats : /ZIG|justice/.test(card[0]) ? ship : [];
    let key = true;
    // type it in
    for (let li = 0; li < card.length; li++) {
      for (let k = 2; k <= card[li].length + 1; k += 2) {
        const c = key ? [...art] : [];
        if (key && li > 0) c.push(cmd.color(15), cmd.text(10, 86, card[0]));
        c.push(cmd.color(n === 7 ? 11 : 15), cmd.text(10, 86 + li * 14, card[li].slice(0, k)));
        if (k % 4 === 0) c.push(cmd.beep(880, 15));
        m.frame(c, key);
        key = false;
      }
    }
    if (/bomb/.test(card[1] || "")) {
      // the bomb goes off
      for (let k = 0; k < 4; k++) m.frame([cmd.color(k % 2 ? 0 : 15), cmd.fill(0, 0, W, 80), cmd.beep(110, 80)]);
      m.frame([cmd.color(0), cmd.fill(0, 0, W, 80)]);
    }
    m.hold(14);
  }
  m.frame([cmd.color(14), cmd.text(70, 40, "HA HA HA HA ....")], true);
  m.hold(19);
  return m;
}

export const samples = [
  { file: "WELCOME.SMV", make: welcome },
  { file: "DANCE.SMV", make: dance },
  { file: "BASE.SMV", make: base },
];

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = path.join(root, "simtube", "MOVIES");
  fs.mkdirSync(dir, { recursive: true });
  for (const s of samples) {
    const text = s.make().toString();
    fs.writeFileSync(path.join(dir, s.file), text);
    const { frames, meta } = parse(text);
    console.log(`simtube/MOVIES/${s.file}: ${meta.title}, ${frames.length} frames, ${text.length} characters, ${cut(text).length} part(s)`);
  }
}
