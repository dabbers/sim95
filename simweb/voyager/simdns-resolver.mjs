// simdns-resolver.mjs - SimDNS name resolution for SIM95, in JavaScript.
//
// The same resolver Simxplorer carries in SPARK (simweb/src/RESOLVE.SPK),
// ported for the SIM95 platform itself: Voyager, or the kernel's own name
// lookup (then every program, Voyager included, gets domain names free).
// No dependencies. It talks to a SimDNS name server (NAMED.SPK, port 53) over
// SIM95's own network stack, so it needs nothing outside the simulation.
//
// What it does, in one line: "www.coolsite.sim" -> ask the name server ->
// follow CNAMEs -> the SIM95 machine name (or address) to connect to. Names
// the name server doesn't know, plain machine names, addresses and anything
// when the name server is down all fall straight through to SIM95's usual
// machine names, so nothing that works today stops working.
//
// Use (see README.md beside this file):
//
//   import { createResolver } from "./simdns-resolver.mjs";
//   const dns = createResolver({ stack, readFile: (p) => disk.exists(p) ? disk.read(p) : null });
//   const { target, viaDns } = await dns.resolve("www.coolsite.sim");
//   const conn = await stack.connect(pid, target, 80);
//   conn.send("GET / HTTP/1.0\nHost: www.coolsite.sim");   // the name typed, not target
//
// The wire protocol (one request, one reply, one message each, port 53):
//   -> QUERY <name> <type>             type: A, CNAME, MX, TXT, NS, ANY
//   <- OK
//      <name> <ttl> <type> <value>     one line per record, CNAMEs followed
//      ...                             through the server's zones
//   <- NXDOMAIN                        no such name
//   <- SERVFAIL <why>
// An MX value is "<preference> <machine>". A CNAME chain that leaves the
// server's zones ends at a SIM95 machine name: that is where to connect.

export const CENTRAL = "starthere.56k.net"; // the central name server (SimNIC)
export const RESOLV_INI = "C:\\SYSTEM\\RESOLV.INI";
export const PORT = 53;
export const WAIT = 2000; // ms to wait for an answer
export const QUIET = 30000; // ms to leave a silent name server alone
export const NEGATIVE = 60000; // ms to remember that SimDNS doesn't know a name
export const MOST = 100; // answers kept
export const MAX_CHAIN = 8; // CNAMEs followed at most

const isAddress = (s) => /^\d{1,3}(\.\d{1,3}){3}$/.test(s);

// SIM95's own ISPs: a name under one (bob.56k.net) is a machine's full name,
// SIM95's to answer, never SimDNS's - so no record can take a machine over.
export const ISPS = ["dialup.zone", "56k.net", "bbs.club", "modem.link", "beep.boop"];
const isIspName = (h) => ISPS.some((isp) => h === isp || h.endsWith("." + isp));

/**
 * @param {object} o
 * @param {{connect(pid:number, host:string, port:number):Promise<any>, resolve(host:string):Promise<string>}} o.stack
 *        SIM95's network stack (Stack in the bundle): connect() gives a
 *        connection with onMessage(fn), onClose(fn), send(text), close().
 * @param {(path:string)=>string|null} [o.readFile]  reads C:\SYSTEM\RESOLV.INI ("" or null when absent)
 * @param {()=>string} [o.hostname]  this machine's name (never asked about)
 * @param {string} [o.central]  the name server to use when RESOLV.INI names none
 * @param {number} [o.pid]  the process the connections belong to (0: the system)
 * @param {()=>number} [o.now]
 */
export function createResolver({ stack, readFile = () => null, hostname = () => "", central = CENTRAL, pid = 0, now = () => Date.now() }) {
  const cache = new Map(); // key -> { target, canonical, until }
  let config = null;
  let configAt = -Infinity;
  let downUntil = 0;
  let serverAddr = "";
  let serverFor = "";
  let serverAt = -Infinity;
  const inFlight = new Map(); // one question per key at a time
  let lastError = "";

  // RESOLV.INI: nameserver=<machine|address|none>, search=<domain>. Read
  // again after 3 seconds, so a changed setting takes without a restart.
  function readConfig() {
    if (config && now() - configAt < 3000) return config;
    let server = central;
    let byDefault = true;
    let search = "";
    let text = "";
    try { text = readFile(RESOLV_INI) || ""; } catch { text = ""; }
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim().toLowerCase();
      if (line.startsWith("nameserver=")) { server = line.slice(11).trim(); byDefault = false; }
      if (line.startsWith("search=")) search = line.slice(7).trim().replace(/^\.|\.$/g, "");
    }
    if (server === "none") server = "";
    config = { server, byDefault, search };
    configAt = now();
    return config;
  }

  // The name the server is asked about: lower case, the search domain on a single word.
  function full(host) {
    let h = host.trim().toLowerCase().replace(/\.$/, "");
    const { search } = readConfig();
    if (!h.includes(".") && search) h += "." + search;
    return h;
  }

  // Is host a name for SimDNS at all? Addresses, localhost, single words
  // (with no search domain), the name server itself and this machine aren't.
  function asks(host) {
    const { server, search } = readConfig();
    const h = host.trim().toLowerCase();
    if (!server || !h || h === "localhost") return false;
    if (now() < downUntil) return false;
    if (isAddress(h)) return false;
    if (!h.includes(".") && !search) return false;
    if (h === server || h === hostname().toLowerCase()) return false;
    if (isIspName(h)) return false;
    return true;
  }

  function remember(key, target, canonical, ms) {
    cache.delete(key);
    if (cache.size >= MOST) cache.delete(cache.keys().next().value);
    cache.set(key, { target, canonical, until: now() + ms });
  }
  function recall(key) {
    const e = cache.get(key);
    if (!e) return null;
    if (now() > e.until) { cache.delete(key); return null; }
    return e;
  }

  function giveUp(why) {
    lastError = why;
    downUntil = now() + QUIET;
    serverAddr = "";
  }

  // The name server's address (asked of SIM95 once a minute).
  async function serverAddress() {
    const { server } = readConfig();
    if (isAddress(server)) return server;
    if (serverAddr && serverFor === server && now() - serverAt < 60000) return serverAddr;
    const addr = await stack.resolve(server).catch(() => "");
    if (!addr) { giveUp("there is no machine called " + server); return ""; }
    serverAddr = addr;
    serverFor = server;
    serverAt = now();
    return addr;
  }

  // One question, one answer (or null: refused, or no answer within WAIT).
  async function ask(name, type) {
    const addr = await serverAddress();
    if (!addr) return null;
    let conn;
    try { conn = await stack.connect(pid, addr, PORT); }
    catch (e) { giveUp("the name server " + readConfig().server + " refused"); return null; }
    const reply = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), WAIT);
      conn.onMessage((text) => { clearTimeout(timer); resolve(String(text)); });
      conn.onClose?.(() => { clearTimeout(timer); resolve(null); });
      conn.send(`QUERY ${name} ${type}`);
    });
    try { conn.close?.(); } catch {}
    if (reply === null) giveUp("no answer from the name server " + readConfig().server);
    return reply;
  }

  // An A/CNAME answer: follow the chain to an address, or to the machine
  // name it ends at. Returns { target, canonical, ttl } or null (no use).
  function readAnswer(name, reply) {
    const records = reply.split(/\r?\n/).slice(1).map((l) => l.split(" ")).filter((w) => w.length >= 4);
    let cur = name;
    let canonical = name;
    let ttl = 3600;
    let target = "";
    for (let hops = 0; hops <= MAX_CHAIN; hops++) {
      let onward = "";
      for (const w of records) {
        if (w[0] !== cur) continue;
        if (w[2] === "A" && !target) target = w[3];
        if (w[2] === "CNAME") onward = w[3];
        if ((w[2] === "A" || w[2] === "CNAME") && Number(w[1]) < ttl) ttl = Number(w[1]);
      }
      if (target) { canonical = cur; break; }
      if (!onward) break;
      canonical = cur;
      cur = onward;
    }
    if (!target) {
      if (cur === name) return null; // a name with no CNAME and no address
      target = cur; // the end of the chain: a SIM95 machine name
    }
    return { target: target.replace(/\.$/, ""), canonical, ttl: Math.max(5, ttl) };
  }

  async function lookup(host) {
    const key = host.trim().toLowerCase();
    const known = recall(key);
    if (known) return known;
    const name = full(host);
    const reply = await ask(name, "A");
    if (reply === null) return null;
    if (reply.startsWith("NXDOMAIN")) { remember(key, "", "", NEGATIVE); return recall(key); }
    if (!reply.startsWith("OK")) { lastError = reply.split("\n")[0]; remember(key, "", "", 10000); return recall(key); }
    const a = readAnswer(name, reply);
    if (!a) { remember(key, "", "", NEGATIVE); return recall(key); }
    remember(key, a.target, a.canonical, a.ttl * 1000);
    return recall(key);
  }

  // One question per name at a time: callers asking the same name share it.
  function once(key, fn) {
    if (!inFlight.has(key)) inFlight.set(key, fn().finally(() => inFlight.delete(key)));
    return inFlight.get(key);
  }

  return {
    /**
     * Where to connect for host. target is the machine name (or address)
     * SimDNS gave, or host itself when SimDNS doesn't know it, is off, or is
     * down: hand that to stack.connect as before. Keep host in Host: and as
     * the cookie key.
     * @returns {Promise<{target:string, canonical:string, viaDns:boolean}>}
     */
    async resolve(host) {
      if (!asks(host)) return { target: host, canonical: host, viaDns: false };
      const e = await once(host.trim().toLowerCase(), () => lookup(host));
      if (!e || !e.target) return { target: host, canonical: host, viaDns: false };
      return { target: e.target, canonical: e.canonical, viaDns: true };
    },

    /**
     * Where mail for domain goes: its MX with the lowest preference, then that
     * machine's CNAMEs; with no MX, the domain's own machine; with no answer
     * at all, the domain itself.
     * @returns {Promise<{target:string, via:"mx"|"domain"|"none"}>}
     */
    async resolveMail(domain) {
      if (!asks(domain)) return { target: domain, via: "none" };
      const key = "mx:" + domain.trim().toLowerCase();
      let e = recall(key);
      if (!e) {
        e = await once(key, async () => {
          const reply = await ask(full(domain), "MX");
          if (reply === null) return null;
          if (!reply.startsWith("OK")) { remember(key, "", "", NEGATIVE); return recall(key); }
          let best = "";
          let pref = Infinity;
          let ttl = 3600;
          for (const w of reply.split(/\r?\n/).slice(1).map((l) => l.split(" "))) {
            if (w.length >= 5 && w[2] === "MX" && Number(w[3]) < pref) { pref = Number(w[3]); best = w[4].replace(/\.$/, ""); ttl = Number(w[1]); }
          }
          remember(key, best || "", full(domain), (best ? Math.max(5, ttl) * 1000 : NEGATIVE));
          return recall(key);
        });
      }
      const host = e && e.target ? e.target : domain;
      const r = await this.resolve(host);
      return { target: r.target, via: e && e.target ? "mx" : r.viaDns ? "domain" : "none" };
    },

    /** Forget every answer (after the name server setting changes). */
    forget() { cache.clear(); downUntil = 0; serverAddr = ""; config = null; },
    /** The name server in use ("" for none) and whether it's the central default. */
    nameServer() { const c = readConfig(); return { server: c.server, central: c.byDefault }; },
    /** The last thing that went wrong, for a status line or log. */
    lastError: () => lastError,
  };
}
