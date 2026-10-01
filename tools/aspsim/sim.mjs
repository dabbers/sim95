// A headless SIM95 for testing ActiveSparkPages and SPARK scripts in Node.
//
// It downloads the live SIM95 bundle from https://sim95.kippy.io/ (cached in
// tools/aspsim/.cache), pulls the real compiler, interpreter, disk and ASP
// renderer out of it, and runs them without a browser. Pages get the same
// time limit (20,000 yields, one per 512 statements), the same 8.3 file names
// and the same errors as on the real machine.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const cacheDir = path.join(here, ".cache");
const SITE = "https://sim95.kippy.io";
// One network message carries at most this many characters (Wp in the bundle).
// Voyager sends a whole request as one message, and HTTPD.SPK a whole page.
export const MESSAGE_LIMIT = 65536;

async function bundlePath() {
  // Bump when the exports below change, so an old cache is rebuilt.
  const out = path.join(cacheDir, "sim95-v4.mjs");
  if (fs.existsSync(out) && !process.env.SIM95_REFRESH) return out;
  fs.mkdirSync(cacheDir, { recursive: true });
  const html = await (await fetch(SITE + "/")).text();
  const m = /src="(\/assets\/[^"]+\.js)"/.exec(html);
  if (!m) throw new Error("Could not find the SIM95 bundle in " + SITE);
  let js = await (await fetch(SITE + m[1])).text();

  // Names in the bundle are minified, so find them by what they contain.
  const name = (re, what) => {
    const r = re.exec(js);
    if (!r) throw new Error("Bundle changed: could not find " + what);
    return r[1];
  };
  const render = name(/async function ([\w$]+)\([\w$]+,[\w$]+,[\w$]+,[\w$]+,[\w$]+=\{\}\)\{const [\w$]+=\{read:/, "the ASP renderer");
  const disk = name(/class ([\w$]+)\{constructor\([\w$]+,[\w$]+=150\)\{this\.storage=/, "the disk");
  const image = name(/function ([\w$]+)\([\w$]+="SIM95",[\w$]+="65\.240\.0\.2"\)/, "the default disk image");
  const compile = name(/function ([\w$]+)\([\w$]+\)\{let [\w$]+;try\{[\w$]+=[\w$]+\([\w$]+\)\}catch\([\w$]+\)\{if\([\w$]+ instanceof [\w$]+\)return\{program:null,errors:\[[\w$]+\]\}/, "the compiler");
  const interp = name(/class ([\w$]+)\{constructor\([\w$]+,[\w$]+\)\{this\.program=[\w$]+,this\.env=[\w$]+,this\.globals=new Map/, "the interpreter");
  const runner = name(/async function ([\w$]+)\([\w$]+,[\w$]+\)\{var [\w$]+;let [\w$]+=0,[\w$]+=\(\)=>[\w$]+\.next\(\)/, "the step runner");
  const fsns = name(/function ([\w$]+)\([\w$]+\)\{return\{Read:[\w$]+=>/, "the FS namespace");
  const netns = name(/function ([\w$]+)\([\w$]+\)\{return\{LocalAddress:/, "the NET namespace");
  const ns = name(/new ([\w$]+)\("FS",/, "the namespace class");
  const builtins = name(/function ([\w$]+)\([\w$]+,[\w$]+\)\{const [\w$]+=[\w$]+\[0\];switch\([\w$]+\)\{case"Str":/, "the built-in functions");
  const pageCompile = name(/function ([\w$]+)\([\w$]+\)\{const [\w$]+=[\w$]+\([\w$]+\),[\w$]+=[\w$]+\([\w$]+\),[\w$]+=[\w$]+\([\w$]+\);if\([\w$]+===null&&[\w$]+\.length===0\)return\{script:null,errors:\[\],hasScript:!1\}/, "the page script compiler");
  const pageRunner = name(/class ([\w$]+)\{constructor\([\w$]+,[\w$]+,[\w$]+=[\w$]+\)\{this\.script=/, "the page script runner");
  const kernel = name(/class ([\w$]+)\{constructor\([\w$]+\)\{this\.procs=new Map,this\.nextPid=1/, "the kernel");
  const stack = name(/class ([\w$]+)\{constructor\([\w$]+\)\{this\.addr="0\.0\.0\.0",this\.listeners=new Map/, "the network stack");
  const sparkRunner = name(/sparkRunner:([\w$]+),hangMs:/, "the SPARK program runner");
  const time = name(/case"TIME":[\w$]+=new [\w$]+\("TIME",([\w$]+)\)/, "TIME");
  const math = name(/case"MATH":[\w$]+=new [\w$]+\("MATH",([\w$]+)\)/, "MATH");

  // Export them, and stop the bundle from starting the desktop.
  const hook = `globalThis.__SIM95={render:${render},Disk:${disk},image:${image},compile:${compile},Interp:${interp},run:${runner},fsns:${fsns},netns:${netns},NS:${ns},builtins:${builtins},pageCompile:${pageCompile},Kernel:${kernel},Stack:${stack},sparkRunner:${sparkRunner},PageScript:${pageRunner},TIME:${time},MATH:${math}};`;
  const boot = /[\w$]+\([\w$]+\)\.render\([\w$]+\.jsx\([\w$]+,\{\}\)\);\s*$/;
  if (!boot.test(js)) throw new Error("Bundle changed: could not find the boot call");
  js = js.replace(boot, hook);
  // The kernel's scheduler keeps one pending callback in a MessageChannel, which
  // is fine for the one kernel in a browser tab but not for several machines in
  // one process. Node has setImmediate; let it use that even with window stubbed.
  const sched = 'if(typeof setImmediate<"u"&&typeof window>"u")';
  if (!js.includes(sched)) throw new Error("Bundle changed: could not find the scheduler");
  js = js.replace(sched, 'if(typeof setImmediate<"u")');
  fs.writeFileSync(out, js);
  return out;
}

function stubBrowser() {
  const el = () => ({ relList: { supports: () => false }, appendChild() {}, addEventListener() {}, setAttribute() {}, style: {} });
  Object.assign(globalThis, {
    window: globalThis, self: globalThis,
    document: { querySelectorAll: () => [], querySelector: () => null, getElementById: el, createElement: el, head: el(), body: el(), addEventListener() {} },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    location: { search: "", href: "http://localhost/", protocol: "https:", host: "localhost", reload() {} },
    MutationObserver: class { observe() {} },
  });
}

let S;
export async function load() {
  if (S) return S;
  stubBrowser();
  await import(await bundlePath());
  S = globalThis.__SIM95;
  return S;
}

// A machine: a fresh default disk plus the host functions a page can reach.
export async function machine(hostname = "SIM95", stack = null) {
  const S = await load();
  const disk = new S.Disk(null);
  disk.restore(S.image(hostname, "65.240.0.2"));
  const m = {
    disk, errors: [],
    read: (p) => disk.read(p), write: (p, t) => disk.write(p, t), exists: (p) => disk.exists(p),
    isDir: (p) => disk.isDir(p), remove: (p) => disk.remove(p), rename: (a, b) => disk.rename(a, b),
    mkdir: (p) => disk.mkdir(p), list: (p) => disk.list(p),
    setTimer: (ms, fn) => setTimeout(fn, ms), beep() {},
    hostname: () => (stack ? stack.hostname() : hostname), localIp: () => (stack ? stack.localIp() : "65.240.0.2"),
    resolve: async (h) => (stack ? (await stack.resolve(h)) : ""), ping: async (h) => (stack ? stack.ping(h) : -1),
    machines: async () => (stack ? stack.machines() : []),
  };
  // Copy a folder from the host into the machine, e.g. putTree("simbook/WEB", "C:\\WEB").
  m.putTree = (src, dest) => {
    if (!disk.exists(dest)) disk.mkdir(dest);
    for (const f of fs.readdirSync(src)) {
      const p = path.join(src, f);
      if (fs.statSync(p).isDirectory()) m.putTree(p, dest + "\\" + f.toUpperCase());
      else disk.write(dest + "\\" + f.toUpperCase(), fs.readFileSync(p, "utf8"));
    }
  };
  // One HTTP request, answered the way HTTPD.SPK answers it.
  // headers: more request headers, e.g. { "User-Agent": "Voyager/1.1 (SIM95)" }.
  m.request = async (method, url, { body = "", cookies = "", budget, headers = {} } = {}) => {
    // Same mapping as PathToFile in HTTPD.SPK, with its INDEX.HTM -> INDEX.ASP fallback.
    const p = url.split("?")[0].replace(/\//g, "\\").toUpperCase();
    let file = "C:\\WEB" + (p.endsWith("\\") ? p + "INDEX.HTM" : p || "\\INDEX.HTM");
    if (file.endsWith("\\INDEX.HTM") && !disk.exists(file)) file = file.replace("\\INDEX.HTM", "\\INDEX.ASP");
    if (!file.endsWith(".ASP")) {
      if (!disk.exists(file) || disk.isDir(file)) return { status: "404 Not Found", headers: [], body: "", raw: "" };
      return { status: "200 OK", headers: [], body: disk.read(file), raw: "" };
    }
    const raw = `${method} ${url} HTTP/1.0\nHost: ${hostname}\n` + (cookies ? `Cookie: ${cookies}\n` : "") + Object.entries(headers).map(([k, v]) => `${k}: ${v}\n`).join("") + "\n" + body;
    if (raw.length > MESSAGE_LIMIT) throw new Error(`Message too long: Voyager cannot send a ${raw.length}-character request`);
    const text = await S.render(m, file, raw, "65.240.0.9", budget ? { budget } : {});
    if (text.length > MESSAGE_LIMIT) throw new Error(`Message too long: HTTPD.SPK would stop sending a ${text.length}-character page for ${url}`);
    const [head, ...rest] = text.split("\n\n");
    const lines = head.split("\n");
    return { status: lines[0].replace(/^HTTP\/1\.0 /, ""), headers: lines.slice(1), body: rest.join("\n\n"), raw: text };
  };
  // Run a SPARK script (no windows, no sockets) with FS, NET, TIME, MATH, and a
  // SYS with Args. Input() answers from `input`, one line per call.
  m.runScript = async (source, { args = [], input = [] } = {}) => {
    const { program, errors } = S.compile(source);
    if (!program) throw new Error("Compile errors:\n" + errors.map((e) => `line ${e.line}: ${e.message}`).join("\n"));
    const out = [];
    const spaces = new Map();
    const env = {
      namespace: (n) => {
        const N = n.toUpperCase();
        if (!spaces.has(N)) {
          if (N === "FS") spaces.set(N, new S.NS("FS", S.fsns(m)));
          else if (N === "NET") spaces.set(N, new S.NS("NET", S.netns(m)));
          else if (N === "SYS") spaces.set(N, new S.NS("SYS", { Args: () => [...args], Pid: () => 1, Ticks: () => 0 }));
          else if (N === "TIME") spaces.set(N, new S.NS("TIME", S.TIME));
          else if (N === "MATH") spaces.set(N, new S.NS("MATH", S.MATH));
          else throw new Error("Not available in the test harness: " + n);
        }
        return spaces.get(N);
      },
      newObject: (n) => { throw new Error("Not available in the test harness: " + n); },
      builtin: (name, args) => {
        const r = S.builtins(name, args);
        if (r) return r.value;
        if (name === "Print") { out.push(args.map(String).join(" ")); return; }
        if (name === "Input") { if (args.length) out.push(String(args[0])); return input.shift() ?? ""; }
        throw new Error("Not available in the test harness: " + name);
      },
      hostHandler: () => null,
    };
    const it = new S.Interp(program, env);
    await S.run(it.runMain(true), { budget: 1e9, sleep: (ms) => new Promise((r) => setTimeout(r, ms)), label: "script", tooLong: "too long" });
    return out;
  };
  return m;
}

// A tiny Voyager: keeps cookies and follows redirects.
export function browser(m) {
  const jar = new Map();
  const b = {
    last: null,
    cookies: () => [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
    async go(method, url, form) {
      const body = form ? Object.entries(form).map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v).replace(/%20/g, "+")).join("&") : "";
      let r = await m.request(method, url, { body, cookies: b.cookies() });
      for (const h of r.headers) {
        const c = /^Set-Cookie: ([^=]+)=(.*)$/.exec(h);
        if (c) { if (c[2] === "") jar.delete(c[1]); else jar.set(c[1], c[2]); }
      }
      const loc = r.headers.find((h) => h.startsWith("Location: "));
      if (r.status.startsWith("302") && loc) {
        const dir = url.split("?")[0].replace(/[^/]*$/, "");
        const to = loc.slice(10);
        return b.go("GET", to.startsWith("/") ? to : dir + to);
      }
      b.last = { ...r, url };
      return b.last;
    },
    get: (url) => b.go("GET", url),
    post: (url, form) => b.go("POST", url, form),
  };
  return b;
}

// The SPARK in a page as Voyager would run it, against a pretend page made of
// the elements that have an id. type(id, text) sets a box and fires its
// onchange, as typing does; el(id) is that element's Value, Text and Enabled.
export async function page(html) {
  const S = await load();
  const { script, errors, hasScript } = S.pageCompile(html);
  if (!hasScript) return null;
  if (!script) throw new Error("Page script error: " + errors.map((e) => e.display ?? e.message).join("; "));
  const els = new Map();
  const attr = (a, n) => (new RegExp(`\\s${n}="([^"]*)"`, "i").exec(a) || [])[1];
  for (const m of html.matchAll(/<(\w+)(\s[^>]*\sid="[^"]+"[^>]*|\s+id="[^"]+"[^>]*)>/gi)) {
    const tag = m[1].toUpperCase(), a = m[2], id = attr(a, "id");
    let value = attr(a, "value") ?? "";
    if (tag === "TEXTAREA") value = html.slice(m.index + m[0].length, html.indexOf("</textarea>", m.index));
    els.set(id, { Id: id, TagName: tag, Value: value, Text: value, Enabled: true, Visible: true, Checked: false, onchange: attr(a, "onchange") });
  }
  let status = "";
  const host = {
    hasElement: (id) => els.has(id),
    getElement: (id, p) => els.get(id)[p],
    setElement: (id, p, v) => { const e = els.get(id); e[p] = v; if (p === "Value" || p === "Text") e.Value = e.Text = v; },
    getTitle: () => "", setTitle() {}, setStatus: (t) => { status = t; }, location: () => "http://localhost/",
    navigate() {}, alert: async () => {}, sleep: (ms) => new Promise((r) => setTimeout(r, ms)), beep() {},
  };
  const run = new S.PageScript(script, host);
  run.start();
  await run.idle();
  const p = {
    el: (id) => els.get(id),
    status: () => status,
    async type(id, text) {
      host.setElement(id, "Value", text);
      const sub = els.get(id).onchange;
      if (sub) { run.fire(sub); await run.idle(); }
      if (status.startsWith("Script error")) throw new Error(status);
    },
  };
  return p;
}
