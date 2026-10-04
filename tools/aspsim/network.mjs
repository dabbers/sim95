// Several headless SIM95 machines on one pretend network, running real SPARK
// programs: the bundle's own kernel, network stack (with its 64K messages,
// refused connections and timeouts) and SPARK runtime, plus a stub display.
//
//   const net = new Network();
//   const a = await net.boot("ALPHA");      // a machine() with a kernel and a stack
//   const pid = a.run("C:\\PROGRAMS\\HTTPD.SPK");
//   await a.request("GET", "/")             // pages, as before (no network)
//   await a.fetch("BRAVO", "/")              // a real HTTP GET over the network
import fs from "node:fs";
import { load, machine } from "./sim.mjs";

const SERVER = "65.255.255.1";
const BROADCAST = "255.255.255.255";

// The network server: hands out addresses, answers name lookups, passes packets.
class Hub {
  constructor() { this.ends = new Map(); this.names = new Map(); this.next = 2; }
  transport() {
    const hub = this;
    const t = {
      connected: true, addr: null, packetFns: [], openFns: [],
      onPacket(f) { t.packetFns.push(f); }, onOpen(f) { t.openFns.push(f); setTimeout(f, 0); }, onClose() {},
      send(p) { if (!t.gone) setTimeout(() => hub.route(t, p), 0); },
      deliver(p) { if (!t.gone) for (const f of t.packetFns) f(p); },
    };
    return t;
  }
  // A machine that goes away without a word (its tab closed): nothing more
  // to it or from it, and no connection of its says goodbye.
  unplug(t) {
    t.gone = true;
    this.ends.delete(t.addr);
    for (const [k, v] of [...this.names]) if (v === t.addr) this.names.delete(k);
  }
  route(from, p) {
    if (from.gone) return;
    if (p.dst === SERVER && p.kind === "name") {
      const q = JSON.parse(p.payload);
      if (q.hello || q.rename) {
        const name = String(q.hello || q.rename).toUpperCase();
        if (!from.addr) { from.addr = "65.16.0." + this.next++; this.ends.set(from.addr, from); }
        this.names.set(name, from.addr);
        from.deliver({ src: SERVER, dst: from.addr, srcPort: 0, dstPort: 0, kind: "name", payload: JSON.stringify({ addr: from.addr, name }) });
      } else if ("query" in q) {
        const n = String(q.query).toUpperCase();
        let addr = this.names.get(n) ?? null;
        if (!addr) for (const [k, v] of this.names) if (k.split(".")[0] === n) addr = v;
        from.deliver({ src: SERVER, dst: from.addr, srcPort: 0, dstPort: 0, kind: "name", payload: JSON.stringify({ query: q.query, addr }) });
      }
      return;
    }
    const packet = { ...p, src: from.addr };
    if (p.dst === BROADCAST) { for (const [a, e] of this.ends) if (a !== from.addr) e.deliver(packet); return; }
    this.ends.get(p.dst)?.deliver(packet);
  }
}

// A display with no screen. Windows, controls and timers keep their properties,
// fire their events, and can be poked at by tests.
class Widget {
  constructor(ui, pid, type, parent, args) {
    Object.assign(this, { ui, pid, type, parent, handlers: new Map(), destroyed: false, timer: null, items: [], text: "" });
    this.props = { Text: "", Visible: type !== "Window", Enabled: true, X: 0, Y: 0, Width: 0, Height: 0, Tag: "", Selected: -1, Checked: false, Interval: 1000, Status: "", Icon: "" };
    if (type === "Window") { this.props.Title = this.props.Text = args[0] ?? ""; this.props.Width = args[1] ?? 0; this.props.Height = args[2] ?? 0; ui.resource(pid, "window", 1); }
    ui.widgets.push(this);
  }
  get(p) {
    if (p === "Items") return [...this.items];
    if (this.type === "TextArea" && (p === "Line" || p === "Column")) {
      const before = String(this.props.Text ?? "").slice(0, this.props.SelStart ?? 0).split("\n");
      return p === "Line" ? before.length : before[before.length - 1].length + 1;
    }
    if (p === "Count") return this.items.length;
    if (p === "Title" || p === "Text") return this.type === "Window" ? this.props.Title : this.props.Text;
    if (p === "Focused" || p === "Active") return false;
    return this.props[p];
  }
  set(p, v) {
    if (this.type === "HtmlView" && p === "Html") { this.props.Html = v; this.elements = htmlElements(String(v)); this.images = new Map(); return; }
    if (p === "Items") this.items = [...v];
    else if (this.type === "Window" && (p === "Title" || p === "Text")) this.props.Title = v;
    else this.props[p] = v;
    if (this.type === "Timer" && p === "Enabled") v ? this.call("Start") : this.call("Stop");
    if (this.type === "Timer" && p === "Interval" && this.timer) { clearInterval(this.timer); this.timer = setInterval(() => this.fire("onTick"), Math.max(1, v)); }
  }
  call(m, ...a) {
    // File dialogs: noted in ui.fileDialogs, answered from ui.files ("" = Cancel)
    if (this.type === "FileDialog" && (m === "ShowOpen" || m === "ShowSave")) {
      this.ui.fileDialogs.push({ pid: this.pid, mode: m === "ShowOpen" ? "open" : "save", title: this.props.Title, path: this.props.Path, filter: this.props.Filter, fileName: this.props.FileName });
      return Promise.resolve(this.ui.files.length ? this.ui.files.shift() : "");
    }
    // A canvas keeps what was drawn on it since it was last cleared, for tests to look at
    if (this.type === "Canvas" && m !== "SetBounds" && m !== "Focus" && m !== "Destroy") {
      if (m === "Clear") this.ops = [];
      else (this.ops ||= []).length < 20000 && this.ops.push([m, ...a]);
      if (m === "SetColor") this.props.Color = a[0];
      return;
    }
    if (this.type === "TextArea") {
      const text = String(this.props.Text ?? "");
      const lines = text.split("\n");
      switch (m) {
        // as in SIM95: GotoLine selects the line, and Insert replaces the selection
        case "GotoLine": { const n = Math.max(1, Math.min(lines.length, a[0])); this.props.SelStart = lines.slice(0, n - 1).reduce((t, l) => t + l.length + 1, 0); this.props.SelLength = lines[n - 1].length; return; }
        case "Insert": { const at = Math.min(text.length, this.props.SelStart ?? text.length), end = Math.min(text.length, at + (this.props.SelLength ?? 0)); this.props.Text = text.slice(0, at) + String(a[0]) + text.slice(end); this.props.SelStart = at + String(a[0]).length; this.props.SelLength = 0; this.fire("onChange"); return; }
        case "GetLine": return lines[a[0] - 1] ?? "";
        case "LineCount": return lines.length;
        default: break;
      }
    }
    if (this.type === "MessageBox" && m === "Show") {
      // A dialog: noted in ui.dialogs, answered from ui.answers (OK/Yes when empty)
      const d = { pid: this.pid, kind: this.props.Kind || "info", buttons: this.props.Buttons || "ok", title: this.props.Title, text: this.props.Text };
      this.ui.dialogs.push(d);
      const answer = this.ui.answers.length ? this.ui.answers.shift() : true;
      return Promise.resolve(d.buttons === "ok" ? true : answer);
    }
    if (this.type === "HtmlView") {
      const els = this.elements || new Map();
      switch (m) {
        case "HasElement": return els.has(String(a[0]));
        case "GetElement": { const e = els.get(String(a[0])); if (!e) throw new Error("No element with id " + a[0]); return e[a[1]]; }
        case "SetElement": { const e = els.get(String(a[0])); if (!e) throw new Error("No element with id " + a[0]); e[a[1]] = a[2]; if (a[1] === "Value" || a[1] === "Text") e.Value = e.Text = String(a[2]); return; }
        case "SetImage": (this.images ||= new Map()).set(String(a[0]), String(a[1])); return;
        default: return;
      }
    }
    if (this.type === "Menu" && m === "AddItem") { this.items.push(String(a[1]).split("\t")[0].replace("&", "")); return; }
    switch (m) {
      case "Show": this.props.Visible = true; return;
      case "Hide": this.props.Visible = false; return;
      case "Close": this.fire("onClose"); this.destroy(); return;
      case "SetBounds": Object.assign(this.props, { X: a[0], Y: a[1], Width: a[2], Height: a[3] }); return;
      case "Add": this.items.push(String(a[0])); return;
      case "Clear": this.items = []; this.text = ""; return;
      case "RemoveAt": this.items.splice(a[0], 1); return;
      case "Get": return this.items[a[0]];
      case "Set": this.items[a[0]] = String(a[1]); return;
      case "IndexOf": return this.items.indexOf(String(a[0]));
      case "Write": this.text += String(a[0]); return;
      case "WriteLine": this.text += String(a[0]) + "\n"; return;
      case "Click": this.fire("onClick"); return;
      case "Start":
        if (!this.timer) { this.ui.resource(this.pid, "timer", 1); this.timer = setInterval(() => this.fire("onTick"), Math.max(1, this.props.Interval)); }
        this.props.Enabled = true; return;
      case "Stop":
        if (this.timer) { clearInterval(this.timer); this.timer = null; this.ui.resource(this.pid, "timer", -1); }
        this.props.Enabled = false; return;
      case "Show" + "": return;
      default: return; // Focus, ScrollToEnd, Center, SelectAll... nothing to draw
    }
  }
  on(ev, fn) { this.handlers.set(ev, fn); }
  fire(ev, ...a) { this.handlers.get(ev)?.(...a); }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const w of this.ui.widgets) if (w.parent === this) w.destroy(); // a window takes its controls with it
    if (this.timer) this.call("Stop");
    if (this.type === "Window") this.ui.resource(this.pid, "window", -1);
  }
}

// What a page's elements hold, as GUI_HtmlView keeps them: the ones with an
// id. Hidden inputs are not drawn, so they are not elements.
function htmlElements(html) {
  const els = new Map();
  const attr = (a, n) => { const m = new RegExp(`\\s${n}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(a); return m ? (m[2] ?? m[3] ?? m[4]).replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&") : undefined; };
  for (const m of html.matchAll(/<(\w+)(\s[^>]*)>/g)) {
    const tag = m[1].toUpperCase(), a = m[2], id = attr(a, "id");
    if (!id || (tag === "INPUT" && (attr(a, "type") || "").toLowerCase() === "hidden")) continue;
    const after = html.slice(m.index + m[0].length);
    const close = after.search(new RegExp(`</${m[1]}>`, "i"));
    const inner = close >= 0 ? after.slice(0, close) : "";
    let value = attr(a, "value") ?? "";
    if (tag === "TEXTAREA") value = inner;
    else if (tag === "SELECT") { const o = [...inner.matchAll(/<option([^>]*)>([^<]*)/gi)]; const sel = o.find((x) => /selected/i.test(x[1])) || o[0]; value = sel ? (attr(sel[1], "value") ?? sel[2].trim()) : ""; }
    else if (tag !== "INPUT" && tag !== "BUTTON") value = inner.replace(/<[^>]*>/g, "");
    els.set(id, { Id: id, TagName: tag, Value: value, Text: value, Checked: /\schecked/i.test(a), Visible: true, Enabled: !/\sdisabled/i.test(a), attrs: a });
  }
  return els;
}

class UI {
  constructor() { this.widgets = []; this.kernel = null; this.dialogs = []; this.answers = []; this.fileDialogs = []; this.files = []; }
  resource(pid, kind, n) { this.kernel?.proc(pid)?.sys.resource(kind, n); }
  registryFor(pid) {
    return { create: (type, parent, ...args) => new Widget(this, pid, type, parent, args), spec() {}, types: () => [] };
  }
  dialog(pid, kind, text, title) { this.dialogs.push({ pid, kind, text, title }); return Promise.resolve(kind !== "confirm"); }
  beep() {}
  releaseAll(pid) { for (const w of this.widgets) if (w.pid === pid) w.destroy(); }
  of(pid) { return this.widgets.filter((w) => w.pid === pid && !w.destroyed); }
}

export class Network {
  constructor() { this.hub = new Hub(); this.machines = []; }

  async boot(hostname) {
    const S = await load();
    const transport = this.hub.transport();
    const stack = new S.Stack({ hostname, jitter: () => 1, transport });
    const m = await machine(hostname, stack);
    // SIM95_HTTPD=file: every machine has that web server instead of the stock
    // one, so a suite can be run again against a replacement (simweb's).
    if (process.env.SIM95_HTTPD) m.write("C:\\PROGRAMS\\HTTPD.SPK", fs.readFileSync(process.env.SIM95_HTTPD, "utf8"));
    const ui = new UI();
    const net = {
      connect: (pid, h, p) => stack.connect(pid, h, p), listen: (pid, p, f) => stack.listen(pid, p, f),
      resolve: (h) => stack.resolve(h), ping: (h) => stack.ping(h), machines: () => stack.machines(),
      localIp: () => stack.localIp(), hostname: () => stack.hostname(), onPacket: (f) => stack.onPacket(f), releaseAll: (pid) => stack.releaseAll(pid),
    };
    const kernel = new S.Kernel({ fs: m.disk, net, ui, programs: {}, sparkRunner: S.sparkRunner, hangMs: 60000 });
    ui.kernel = kernel;
    stack.onResource = (pid, n) => kernel.proc(pid)?.sys.resource("socket", n);
    kernel.onProcessError = (pid, e) => { m.errors.push(`[pid ${pid}] ${e?.message ?? e}`); };
    await stack.whenOnline(2000);
    Object.assign(m, { stack, kernel, ui, errors: [], outputs: new Map() });

    // Start a program; Print goes to m.output(pid). Runtime errors land in m.ui.dialogs.
    m.run = (p, args = []) => {
      const out = { text: "", destroyed: false, call(method, t) { if (method === "Write") out.text += String(t); } };
      const pid = kernel.spawn(p, args, { stdout: out });
      m.outputs.set(pid, out);
      return pid;
    };
    m.output = (pid) => m.outputs.get(pid)?.text ?? "";
    m.running = (pid) => kernel.ps().some((p) => p.pid === pid);
    m.widgets = (pid, type) => ui.of(pid).filter((w) => !type || w.type === type);
    m.button = (pid, text) => m.widgets(pid, "Button").find((b) => String(b.get("Text")).replace("&", "") === text);
    // A real GET over the network, the way Voyager does it.
    m.fetch = async (host, path = "/") => {
      const conn = await stack.connect(0, host, 80);
      const parts = [];
      const done = new Promise((r) => conn.onClose(r));
      conn.onMessage((t) => parts.push(t));
      conn.send(`GET ${path} HTTP/1.0\nHost: ${host.toLowerCase()}\nUser-Agent: test`);
      await done;
      return parts.join("\n");
    };
    // Gone from the network at once, as when its browser tab is closed: its
    // programs stop, and the other machines' connections to it just go quiet.
    m.unplug = () => {
      this.hub.unplug(transport);
      for (const p of kernel.ps()) kernel.kill(p.pid);
    };
    this.machines.push(m);
    return m;
  }

  // Wait until fn() is true (or give up after ms).
  async until(fn, ms = 10000, what = "condition") {
    const end = Date.now() + ms;
    while (Date.now() < end) { if (await fn()) return; await new Promise((r) => setTimeout(r, 20)); }
    throw new Error("Timed out waiting for " + what);
  }

  shutdown() { for (const m of this.machines) for (const p of m.kernel.ps()) m.kernel.kill(p.pid); }
}
