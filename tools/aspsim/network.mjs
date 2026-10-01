// Several headless SIM95 machines on one pretend network, running real SPARK
// programs: the bundle's own kernel, network stack (with its 64K messages,
// refused connections and timeouts) and SPARK runtime, plus a stub display.
//
//   const net = new Network();
//   const a = await net.boot("ALPHA");      // a machine() with a kernel and a stack
//   const pid = a.run("C:\\PROGRAMS\\HTTPD.SPK");
//   await a.request("GET", "/")             // pages, as before (no network)
//   await a.fetch("BRAVO", "/")              // a real HTTP GET over the network
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
      send(p) { setTimeout(() => hub.route(t, p), 0); },
      deliver(p) { for (const f of t.packetFns) f(p); },
    };
    return t;
  }
  route(from, p) {
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
    if (p === "Count") return this.items.length;
    if (p === "Title" || p === "Text") return this.type === "Window" ? this.props.Title : this.props.Text;
    if (p === "Focused" || p === "Active") return false;
    return this.props[p];
  }
  set(p, v) {
    if (p === "Items") this.items = [...v];
    else if (this.type === "Window" && (p === "Title" || p === "Text")) this.props.Title = v;
    else this.props[p] = v;
    if (this.type === "Timer" && p === "Enabled") v ? this.call("Start") : this.call("Stop");
  }
  call(m, ...a) {
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
    if (this.timer) this.call("Stop");
    if (this.type === "Window") this.ui.resource(this.pid, "window", -1);
  }
}

class UI {
  constructor() { this.widgets = []; this.kernel = null; this.dialogs = []; }
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
    const stack = new S.Stack({ hostname, jitter: () => 1, transport: this.hub.transport() });
    const m = await machine(hostname, stack);
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
