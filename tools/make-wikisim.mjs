// Makes WikiSim's data (wikisim/DATA/*.TXT): Wikipedia's Vital Articles
// (Level 3) and a hand-picked list of 1990s computing and pop culture, cut back
// to 1996. The text is Wikipedia's (CC BY-SA 4.0), shortened and edited.
//   node tools/make-wikisim.mjs             (fetch what is missing, then build)
//   node tools/make-wikisim.mjs --offline   (no network: build from what is in
//                                            tools/.wikicache, skipping the rest)
//
// Wikipedia rate-limits busy addresses, so this is gentle: one request at a
// time, at least 3 seconds apart, 20 intros to a request, backing off (30s,
// 60s, 120s... up to 15 minutes) whenever it is told to slow down, and every
// answer is kept in tools/.wikicache so a rerun only fetches what it does not
// have yet. About 60 requests make the whole set.
//
// Links are WikiSim's own: another article's title in the text becomes a
// link to it, and an article's "See also" is the articles that link to it.
//
// The 1996 cut (see wikisim/README.md): each intro is split into sentences,
// and a sentence goes if it names a year after 1996, says "as of 20xx", or
// names something from after 1996 (BANNED below). An article goes if its
// subject is from after 1996 (the first sentence goes, or its earliest year is
// after 1996) or too little is left.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cacheDir = path.join(root, "tools", ".wikicache");
const outDir = path.join(root, "wikisim", "DATA");
const API = "https://en.wikipedia.org/w/api.php";
const UA = "sim95-wikisim-build/1.0 (https://github.com/dabbers/sim95)";
const offline = process.argv.includes("--offline");

// ---------------------------------------------------------------- settings

export const MAXTEXT = 560;      // characters of intro kept per article
export const HARDMAX = 1100;     // ...unless the first sentences are short and the next is long
export const MINTEXT = 200;      // less than this left after the cut: the article goes
export const VOLSIZE = 30000;    // bytes per volume file
export const SEEALSO = 8;        // "See also" entries per article

// Period computing, internet and pop culture: all of it here by 1996.
export const EXTRA = `
Modem|Bulletin board system|Netscape Navigator|Mosaic (web browser)|Windows 95|Windows 3.1x|Classic Mac OS|MS-DOS|OS/2|Doom (1993 video game)|Myst|Tamagotchi|CompuServe|Prodigy (online service)|AOL|Usenet|Internet Relay Chat|Gopher (protocol)|File Transfer Protocol|Floppy disk|CD-ROM|Pentium (original)|Intel 80486|Intel 80386|Motorola 68000|PowerPC|Apple II|Macintosh|IBM Personal Computer|Commodore 64|Amiga|Atari ST|ZX Spectrum|Atari 2600|Nintendo Entertainment System|Super Nintendo Entertainment System|Sega Genesis|Game Boy|PlayStation (console)|Sega Saturn|Nintendo 64|Tetris|Pac-Man|Super Mario Bros.|The Legend of Zelda (video game)|Sonic the Hedgehog (1991 video game)|Street Fighter II|Mortal Kombat (1992 video game)|SimCity (1989 video game)|Wolfenstein 3D|Quake (video game)|Command & Conquer (1995 video game)|Warcraft II: Tides of Darkness|The Oregon Trail (series)|Lemmings (video game)|Space Invaders|Microsoft Windows|Microsoft Office|Microsoft Word|WordPerfect|Lotus 1-2-3|Microsoft Excel|VisiCalc|HyperCard|Unix|Linux|Linux kernel|GNU Project|Free Software Foundation|BASIC|C (programming language)|C++|Java (programming language)|JavaScript|Perl|Pascal (programming language)|Fortran|COBOL|HTML|HTTP|World Wide Web|Hyperlink|URL|Web browser|Email|Electronic mailing list|ARPANET|TCP/IP|Ethernet|Local area network|Dial-up Internet access|Internet service provider|Hayes Microcomputer Products|Search engine|Yahoo!|AltaVista|Lycos|Excite (web portal)|Amazon (company)|eBay|GeoCities|Tim Berners-Lee|Bill Gates|Steve Jobs|Steve Wozniak|Linus Torvalds|Microsoft|Apple Inc.|IBM|Intel|Netscape|Sun Microsystems|Silicon Graphics|Hewlett-Packard|Compaq|Dell|Atari|Nintendo|Sega|Sony|Video game console|Arcade video game|Personal digital assistant|Apple Newton|Pager|Mobile phone|Fax|Walkman|Compact disc|VHS|Videocassette recorder|LaserDisc|Cable television|MTV|CNN|Hacker|Computer virus|Cyberpunk|Neuromancer|William Gibson|The Hitchhiker's Guide to the Galaxy|Star Trek: The Next Generation|Star Wars (film)|The X-Files|Friends|Seinfeld|The Simpsons|Twin Peaks|Nirvana (band)|Grunge|Hip hop music|Michael Jackson|Madonna|Jurassic Park (film)|Toy Story|Pulp Fiction|Forrest Gump|The Lion King|Independence Day (1996 film)|Terminator 2: Judgment Day|Back to the Future|Blade Runner|Tron|WarGames|The Net (1995 film)|Hackers (film)|Dungeons & Dragons|Magic: The Gathering|Rubik's Cube|Lego|Barbie|Pokémon|Sony Walkman|Fall of the Berlin Wall|Dissolution of the Soviet Union|Gulf War|Nelson Mandela|Bill Clinton|1996 Summer Olympics|Channel Tunnel|Hubble Space Telescope|Space Shuttle|Mir|Dolly (sheep)|Human Genome Project|Hale–Bopp|Comet Shoemaker–Levy 9
`.trim().split("|");

// Things from after 1996: a sentence naming one goes. Matched as whole words,
// any case, unless the entry is marked "=" (then the case must match).
export const BANNED = [
  "smartphone", "smartphones", "social media", "social network", "social networking", "iPhone", "iPad", "iPod", "Android", "Facebook",
  "Google", "YouTube", "Twitter", "Instagram", "TikTok", "Snapchat", "WhatsApp", "Reddit", "Netflix", "Spotify", "Wikipedia", "Wikimedia",
  "Wi-Fi", "Bluetooth", "broadband", "streaming", "podcast", "podcasts", "emoji", "selfie", "blog", "blogs", "blogging", "tablet computer",
  "cloud computing", "Web 2.0", "app store", "COVID", "COVID-19", "coronavirus", "COVID-19 pandemic", "Bitcoin", "cryptocurrency", "blockchain",
  "Brexit", "=euro", "=eurozone", "=Eurozone", "Obama", "Trump", "Putin", "Xi Jinping", "September 11", "9/11", "al-Qaeda", "Islamic State", "ISIS",
  "Arab Spring", "War on Terror", "Iraq War", "Great Recession", "financial crisis", "South Sudan", "Eswatini", "North Macedonia", "Czechia",
  "Timor-Leste", "dwarf planet", "Higgs", "International Space Station", "same-sex marriage", "Harry Potter", "Elon Musk", "Tesla, Inc.",
  "SpaceX", "millennials", "Generation Z", "deep learning", "CRISPR", "Large Hadron Collider", "exoplanets", "Euro", "21st century",
  "twenty-first century", "the 2000s", "the 2010s", "the 2020s", "Xbox", "PlayStation 2", "PlayStation 3", "PlayStation 4", "Wii",
  "Windows XP", "Windows 7", "Windows 10", "macOS", "Mac OS X", "iOS", "DVD", "HDTV", "high-definition", "LGBTQ", "texting",
  "special administrative region", "Wikidata", "the Internet age", "World Heritage Site",
];

// ---------------------------------------------------------------- fetching

let lastAt = 0;
let gapMs = 3000;   // between requests; grows each time we are told to slow down
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stats = { throttled: 0, fetched: 0, skipped: 0 };

// One GET of JSON, from the cache when it can be. Waits at least 3 seconds
// after the last request, and backs off from 30 seconds, doubling, whenever
// Wikipedia says to slow down, and leaves more time between requests from
// then on. It never gives up: it just waits longer.
async function getJson(url) {
  const file = path.join(cacheDir, crypto.createHash("sha1").update(url).digest("hex").slice(0, 16) + ".json");
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  if (offline) return null;
  let wait = 30000;
  for (;;) {
    const gap = Date.now() - lastAt;
    if (gap < gapMs) await sleep(gapMs - gap);
    lastAt = Date.now();
    let body = "";
    let status = 0;
    try {
      // curl, so the request goes through any HTTPS_PROXY this machine has
      const out = execFileSync("curl", ["-sS", "-m", "60", "-A", UA, "-w", "\n%{http_code}", url], { encoding: "utf8", maxBuffer: 64 << 20 });
      status = Number(out.slice(out.lastIndexOf("\n") + 1));
      body = out.slice(0, out.lastIndexOf("\n"));
    } catch (e) { body = String(e.message); }
    let data = null;
    try { data = JSON.parse(body); } catch { data = null; }
    // a page that is not there is an answer too, and is kept
    const told = data && data.error && /maxlag|ratelimit|toomany/i.test(data.error.code || "");
    if ((status === 200 && !told) || status === 404) {
      data = data || {};
      data.status = status;
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(file, JSON.stringify(data));
      stats.fetched++;
      return data;
    }
    stats.throttled++;
    gapMs = Math.min(Math.round(gapMs * 1.5), 60000);
    console.log(`  ${status === 429 || /too many requests/i.test(body) ? "throttled" : "failed (" + status + ")"}; waiting ${wait / 1000}s`);
    await sleep(wait);
    wait = Math.min(wait * 2, 15 * 60000);
  }
}

// The Level 3 list: the first [[link]] of every list item, from the page's
// source (the action API follows the old name's redirect).
async function vitalTitles() {
  const d = await getJson(API + "?" + new URLSearchParams({ action: "parse", page: "Wikipedia:Vital articles/Level/3", prop: "wikitext", redirects: "1", format: "json", formatversion: "2" }));
  if (!d) throw new Error("The Vital Articles list is not in tools/.wikicache: run without --offline once.");
  const titles = [];
  for (const line of d.parse.wikitext.split("\n")) {
    if (!/^[#*]/.test(line)) continue;
    const m = line.match(/\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/);
    if (!m) continue;
    const t = m[1].trim();
    if (/^(Wikipedia|Category|File|Image|Template|Help|Portal|Talk|User|Special|WP):/i.test(t) || t.startsWith(":")) continue;
    titles.push(t[0].toUpperCase() + t.slice(1).replace(/_/g, " "));
  }
  return [...new Set(titles)];
}

// Each article's intro as plain text, 20 titles to a request, following
// redirects: the title the API answers with is the article's real one.
async function intros(titles) {
  const got = new Map();
  for (let i = 0; i < titles.length; i += 20) {
    const batch = titles.slice(i, i + 20);
    process.stdout.write(`  intros ${i + batch.length}/${titles.length} \r`);
    let cont = {};
    for (;;) {
      const d = await getJson(API + "?" + new URLSearchParams({ action: "query", prop: "extracts", exintro: "1", explaintext: "1", exlimit: "20", redirects: "1", titles: batch.join("|"), format: "json", formatversion: "2", ...cont }));
      if (!d) { stats.skipped += batch.length; break; }   // --offline, and not fetched yet
      const alias = new Map();
      for (const r of [...(d.query.normalized || []), ...(d.query.redirects || [])]) alias.set(r.from, r.to);
      for (const p of d.query.pages) {
        if (p.missing || !p.extract || got.has(p.title)) continue;
        got.set(p.title, { title: p.title, text: p.extract, asked: [] });
      }
      for (const t of batch) {
        let to = t;
        for (let n = 0; n < 3 && alias.has(to); n++) to = alias.get(to);
        if (got.has(to) && !got.get(to).asked.includes(t)) got.get(to).asked.push(t);
      }
      if (!d.continue) break;
      cont = d.continue;
    }
  }
  console.log();
  return got;
}

// ---------------------------------------------------------------- the 1996 cut

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// whole words: no letter (any alphabet), digit or hyphen either side
const bannedRe = BANNED.map((b) => b.startsWith("=") ? new RegExp("(?<![\\p{L}\\p{N}_-])" + esc(b.slice(1)) + "(?![\\p{L}\\p{N}_-])", "u") : new RegExp("(?<![\\p{L}\\p{N}_-])" + esc(b) + "(?![\\p{L}\\p{N}_-])", "iu"));
export const LATEYEAR = /(?<!\d)(199[7-9]|20\d\d)(?!\d)/;
export const isLate = (s) => LATEYEAR.test(s) || /\bas of 20\d\d/i.test(s) || bannedRe.some((r) => r.test(s));
export const lateWord = (s) => (s.match(LATEYEAR) || [])[0] || (bannedRe.find((r) => r.test(s)) || "").toString();

// Tidies an extract: pronunciation and empty brackets go, spaces close up.
function tidy(text) {
  return text
    .replace(/\r/g, "")
    .replace(/\s*\((?:[^()]*?;\s*)?(?:listen|pronounced|IPA|\/)[^()]*\)/g, "")
    .replace(/\(\s*[,;]?\s*\)/g, "")
    .replace(/\(\s*[,;]\s*/g, "(")
    .replace(/[ \t]+/g, " ")
    .replace(/ ([,.;:])/g, "$1")
    .replace(/[|\u2028\u2029]/g, " ")
    .replace(/\{/g, "(").replace(/\}/g, ")").replace(/\\/g, "/")
    .trim();
}

const ABBR = /\b(?:c|ca|e\.g|i\.e|etc|vs|Mr|Mrs|Ms|Dr|St|Jr|Sr|No|Mt|Ft|U\.S|U\.K|U\.N|Inc|Ltd|Co|Corp|approx|lit|b|d|fl|r|Gen|Gov|Sen|Rev|Prof|Ph\.D|A\.D|B\.C|a\.k\.a|[A-Z])\.$/;
// Splits a paragraph into sentences, not at "c." or "U.S." or initials.
export function sentences(para) {
  const out = [];
  let cur = "";
  for (const piece of para.split(/(?<=[.!?]["')\]]?)\s+(?=["'(\[]?[A-Z0-9])/)) {
    cur = cur ? cur + " " + piece : piece;
    if (ABBR.test(cur)) continue;
    out.push(cur);
    cur = "";
  }
  if (cur) out.push(cur);
  return out;
}

const years = (s) => [...s.matchAll(/(?<!\d)(1[0-9]\d\d|20\d\d)(?!\d)(?!\s*(?:km|kilometres|metres|m\b|people|feet|ft|species|kg|BC|BCE))/g)].map((m) => Number(m[1]));

// Cuts one article back to 1996. Returns the text kept, or why it went.
export function cut1996(title, raw) {
  if (isLate(title)) return { drop: "title: " + lateWord(title) };
  const paras = tidy(raw).split(/\n+/).map((p) => p.trim()).filter(Boolean);
  if (!paras.length) return { drop: "empty" };
  const first = sentences(paras[0])[0];
  // "X is a 2004 film": a late year before the first comma is the subject's own
  const ys = years(first.split(", ")[0]);
  if (ys.length && Math.min(...ys) > 1996) return { drop: "subject from " + Math.min(...ys) };
  const kept = [];
  let len = 0;
  let cutCount = 0;
  let isFirst = true;
  outer: for (const p of paras) {
    const ss = [];
    for (let s of sentences(p)) {
      if (isLate(s)) s = mend(s, isFirst);
      if (isFirst && !s) return { drop: "first sentence: " + lateWord(first) };
      isFirst = false;
      if (!s) { cutCount++; continue; }
      // past MAXTEXT it stops, unless that would leave too little (then up to HARDMAX)
      if (len && len + s.length + 1 > (len < MINTEXT ? HARDMAX : MAXTEXT)) { if (ss.length) kept.push(ss.join(" ")); break outer; }
      ss.push(retense(s));
      len += s.length + 1;
    }
    if (ss.length) kept.push(ss.join(" "));
  }
  const text = kept.join("\n");
  if (text.length < MINTEXT) return { drop: "too short after the cut (" + text.length + ")" };
  return { text, cut: cutCount };
}

// A sentence that names something after 1996 can sometimes keep its start:
// someone's dates become "born ...", "from 1993 to 2001" becomes "from 1993",
// and clauses go from the end until what is left is from 1996. "" when
// nothing worth keeping is left.
function mend(s, isFirst) {
  const late = "(?:199[7-9]|20\\d\\d)";
  if (isFirst) s = s.replace(new RegExp("^([^()]{1,80}?) \\(([^()]*?\\d{3,4})\\s*[–-]\\s*[^()]*?" + late + "\\)(?= (?:was|is) )"), "$1 (born $2)");
  s = s.replace(new RegExp("\\bfrom (\\d{4}) (?:to|until) (?:[A-Z][a-z]+ )?(?:\\d{1,2},? )?" + late + "\\b", "g"), "from $1");
  while (isLate(s)) {
    const cut = Math.max(s.lastIndexOf(", "), s.lastIndexOf("; "), s.lastIndexOf(" – "));
    if (cut < 40) return "";
    s = s.slice(0, cut).replace(/\s*\([^)]*$/, "") + ".";
  }
  // a clause cut off after "and" or "such as" reads badly
  if (/\b(?:and|or|such as|including|the|a|an|of|in|with)\.$/.test(s)) return "";
  // an article's first sentence has to say what its subject is
  if (isFirst && !/\b(?:is|was|are|were)\b/.test(s)) return "";
  return s;
}

// A light touch: "is the current" reads oddly in a 1996 book.
function retense(s) {
  return s.replace(/\bis the current\b/g, "is the present").replace(/\bis currently\b/g, "is at present");
}

// ---------------------------------------------------------------- building

export const MAXLINKS = 12;      // links in one article's text

// Finds other WikiSim titles in an article's text (longest first, whole
// words, the first time each comes up), for the in-article links. A loose
// name also matches with a small first letter ("water" for Water).
// Returns [[start, length, id]...].
function mentions(text, names, selfId) {
  const found = [];
  const taken = new Array(text.length).fill(false);
  for (const { name, id, loose } of names) {
    if (id === selfId || found.length >= MAXLINKS) continue;
    const head = loose && /[A-Z]/.test(name[0]) ? "[" + name[0] + name[0].toLowerCase() + "]" : esc(name[0]);
    const re = new RegExp("(?<![\\w-])" + head + esc(name.slice(1)) + "(?![\\w-])");
    const m = re.exec(text);
    if (!m) continue;
    if (taken.slice(m.index, m.index + name.length).some(Boolean)) continue;
    if (found.some((f) => f[2] === id)) continue;
    for (let i = m.index; i < m.index + name.length; i++) taken[i] = true;
    found.push([m.index, name.length, id]);
  }
  return found.sort((a, b) => a[0] - b[0]);
}

// Marks links in the text as {id|words}.
function markLinks(text, found) {
  let out = "";
  let at = 0;
  for (const [i, n, id] of found) {
    out += text.slice(at, i) + "{" + id + "|" + text.slice(i, i + n) + "}";
    at = i + n;
  }
  return out + text.slice(at);
}

// A short display name: "Doom (1993 video game)" is linked as "Doom".
const short = (t) => t.replace(/\s*\([^)]*\)$/, "");

async function main() {
  console.log("Vital articles, level 3...");
  const vital = await vitalTitles();
  console.log(`  ${vital.length} titles`);
  const wanted = [...new Set([...vital, ...EXTRA])];
  const got = await intros(wanted);
  console.log(`  ${got.size} articles found of ${wanted.length} asked for`);

  const kept = [];
  const dropped = [];
  for (const a of [...got.values()].sort((x, y) => x.title.localeCompare(y.title))) {
    const r = cut1996(a.title, a.text);
    if (r.drop) dropped.push(a.title + ": " + r.drop);
    else kept.push({ title: a.title, text: r.text, cut: r.cut, extra: !a.asked.some((t) => vital.includes(t)) });
  }
  console.log(`  kept ${kept.length}, dropped ${dropped.length} by the 1996 cut`);
  kept.forEach((a, i) => (a.id = i + 1));

  // In-article links: other articles' titles found in the text (and their
  // short forms, when no other article has that name). Vital articles are
  // everyday words too ("water"); the extras are names, matched exactly.
  const names = new Map();
  for (const a of kept) names.set(a.title, { name: a.title, id: a.id, loose: !a.extra && !a.title.includes(" ") });
  for (const a of kept) if (!names.has(short(a.title)) && short(a.title).length > 3) names.set(short(a.title), { name: short(a.title), id: a.id, loose: false });
  const nameList = [...names.values()].sort((x, y) => y.name.length - x.name.length || x.id - y.id);
  for (const a of kept) {
    const found = mentions(a.text, nameList, a.id);
    a.marked = markLinks(a.text, found);
    a.out = new Set(found.map((f) => f[2]));
  }
  // See also: the articles that link here (both ways first), less the ones
  // this text already links to.
  for (const a of kept) {
    const back = kept.filter((b) => b.out.has(a.id) && !a.out.has(b.id));
    a.see = back.slice(0, SEEALSO).map((b) => b.id);
  }

  // write: volumes of whole articles, the index, the links
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  let vol = 1;
  let buf = "";
  const index = [];
  for (const a of kept) {
    const line = a.id + "|" + a.title + "|" + a.marked.replace(/\n/g, "\\") + "\n";
    if (buf.length + line.length > VOLSIZE) { fs.writeFileSync(path.join(outDir, `VOL${String(vol).padStart(2, "0")}.TXT`), buf); vol++; buf = ""; }
    buf += line;
    a.vol = vol;
    const L = a.title[0].toUpperCase();
    index.push([a.id, a.title, /[A-Z]/.test(L) ? L : "#", a.vol].join("|"));
  }
  fs.writeFileSync(path.join(outDir, `VOL${String(vol).padStart(2, "0")}.TXT`), buf);
  fs.writeFileSync(path.join(outDir, "INDEX.TXT"), index.join("\n") + "\n");
  fs.writeFileSync(path.join(outDir, "LINKS.TXT"), kept.filter((a) => a.see.length).map((a) => a.id + "|" + a.see.join(" ")).join("\n") + "\n");
  // Did you know? The second sentence of some articles, when it stands on its own.
  const dyk = kept.filter((a) => a.extra || a.id % 3 === 0).map((a) => {
    const s = sentences(a.text.split("\n")[0]);
    return s.length > 1 && s[1].length > 40 && s[1].length < 200 && !/^(It|This|These|They|He|She|His|Her|Its|The two|Both|However|In|As)\b/.test(s[1]) ? a.id + "|" + s[1] : null;
  }).filter(Boolean);
  fs.writeFileSync(path.join(outDir, "DYK.TXT"), dyk.join("\n") + "\n");
  fs.writeFileSync(path.join(root, "wikisim", "DROPPED.TXT"), dropped.join("\n") + "\n");

  const size = fs.readdirSync(outDir).reduce((n, f) => n + fs.statSync(path.join(outDir, f)).size, 0);
  console.log(`  ${kept.length} articles (${kept.filter((a) => a.extra).length} of them extras) in ${vol} volumes, ${dyk.length} did-you-knows, ${size} bytes of data`);
  console.log(`  ${kept.reduce((n, a) => n + a.cut, 0)} sentences cut from the articles kept`);
  console.log(`  ${stats.fetched} fetched, throttled ${stats.throttled} times` + (stats.skipped ? `, ${stats.skipped} titles skipped (not in the cache)` : ""));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
