// Tests for simweb/voyager/simdns-resolver.mjs: SimDNS name resolution in
// JavaScript, for the SIM95 platform itself (Voyager, or the kernel's own
// lookup). It runs against the real SIM95 network stack and the real name
// server (simnic/src/NAMED.SPK) on a pretend network:
//   STARTHERE.56k.net  the central name server, zone coolsite.sim
//   ALPHA              simweb's web server: coolsite.sim and www. as a site
//   BRAVO              takes coolsite.sim's mail (MX)
//   CLIENT             no RESOLV.INI at all: the central name server, by default
//   node tools/aspsim/voyagerdns.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Network } from "./network.mjs";
import { createResolver, CENTRAL } from "../../simweb/voyager/simdns-resolver.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const src = (f) => fs.readFileSync(path.join(root, f), "utf8");
let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log("ok    " + name); }
  catch (e) { failures++; console.log("FAIL  " + name + "\n      " + String(e.message || e).split("\n").join("\n      ") + "\n      " + String(e.stack || "").split("\n").slice(1, 3).join("\n      ")); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const net = new Network();
const central = await net.boot("STARTHERE.56k.net");
const alpha = await net.boot("ALPHA");
const bravo = await net.boot("BRAVO");
const client = await net.boot("CLIENT");
const until = (fn, what, ms = 10000) => net.until(fn, ms, what);

central.mkdir("C:\\DNS");
central.write("C:\\DNS\\NAMED.CNF", "directory C:\\DNS\nprimary coolsite.sim COOLSITE.SIM\n");
central.write("C:\\DNS\\COOLSITE.SIM", `$TTL 300
@        CNAME  alpha             ; the domain: a CNAME straight to a machine
www      CNAME  alpha
shop     CNAME  store             ; a chain inside the zone...
store    CNAME  www               ; ...to the machine
old  60  A      65.16.0.250       ; an address, just in case
@        MX     10 bravo
@        MX     20 alpha
loop1    CNAME  loop2
loop2    CNAME  loop1
`);
central.write("C:\\PROGRAMS\\NAMED.SPK", src("simnic/src/NAMED.SPK"));
central.run("C:\\PROGRAMS\\NAMED.SPK");
await until(() => central.kernel.ps().some((p) => p.name === "NAMED"), "the name server");
await sleep(500);

// ALPHA serves coolsite.sim by name with simweb's web server
alpha.mkdir("C:\\WEB\\SITES");
alpha.mkdir("C:\\WEB\\SITES\\COOL");
alpha.write("C:\\WEB\\SITES\\COOL\\INDEX.HTM", "<html><head><title>Cool Site</title></head><body>Welcome to coolsite.sim!</body></html>");
alpha.write("C:\\WEB\\VHOSTS.TXT", "coolsite.sim|C:\\WEB\\SITES\\COOL\nwww.coolsite.sim|C:\\WEB\\SITES\\COOL\n");
alpha.write("C:\\PROGRAMS\\HTTPD.SPK", src("simweb/src/HTTPD.SPK"));
alpha.write("C:\\PROGRAMS\\PWM.SPK", "SUB Main ()\nEND SUB\n");
alpha.run("C:\\PROGRAMS\\HTTPD.SPK");
await sleep(500);

// The resolver as the platform would use it: SIM95's own stack and disk.
const resolverFor = (m, extra = {}) => createResolver({
  stack: m.stack,
  readFile: (p) => (m.exists(p) ? m.read(p) : null),
  hostname: () => m.stack.hostname(),
  ...extra,
});

// A page fetched the way Voyager would with it: connect to the target,
// say the name that was typed in Host:.
async function get(m, dns, host, p = "/") {
  const { target } = await dns.resolve(host);
  const conn = await m.stack.connect(0, target, 80);
  const parts = [];
  const done = new Promise((r) => conn.onClose(r));
  conn.onMessage((t) => parts.push(t));
  conn.send(`GET ${p} HTTP/1.0\nHost: ${host}\nUser-Agent: Voyager/1.1 (SIM95)`);
  await Promise.race([done, sleep(6000)]);
  return parts.join("\n");
}

const dns = resolverFor(client);

await test("with no RESOLV.INI, the central name server answers: a CNAME straight to a machine", async () => {
  assert.equal(CENTRAL, "starthere.56k.net");
  assert.ok(!client.exists("C:\\SYSTEM\\RESOLV.INI"));
  assert.deepEqual(dns.nameServer(), { server: "starthere.56k.net", central: true });
  assert.deepEqual(await dns.resolve("www.coolsite.sim"), { target: "alpha", canonical: "www.coolsite.sim", viaDns: true });
  assert.deepEqual(await dns.resolve("coolsite.sim"), { target: "alpha", canonical: "coolsite.sim", viaDns: true });
});

await test("CNAME to CNAME to a machine; an A record; any case and a last dot", async () => {
  assert.deepEqual(await dns.resolve("shop.coolsite.sim"), { target: "alpha", canonical: "www.coolsite.sim", viaDns: true });
  assert.deepEqual(await dns.resolve("old.coolsite.sim"), { target: "65.16.0.250", canonical: "old.coolsite.sim", viaDns: true });
  assert.equal((await dns.resolve("WWW.CoolSite.SIM.")).target, "alpha");
});

await test("everything SimDNS doesn't know falls through to SIM95 names, unchanged", async () => {
  for (const host of ["bravo", "alpha", "65.16.0.9", "localhost", "nope.coolsite.sim", "loop1.coolsite.sim", "starthere.56k.net", "client", "bob.56k.net", "alpha.dialup.zone"]) {
    const r = await dns.resolve(host);
    assert.deepEqual(r, { target: host, canonical: host, viaDns: false }, host);
  }
});

await test("a page by name: connect to the machine, Host: the name (simweb's web server picks the site)", async () => {
  const page = await get(client, dns, "www.coolsite.sim");
  assert.match(page, /^HTTP\/1.0 200/);
  assert.match(page, /Welcome to coolsite.sim!/);
  // and a plain machine name still works the old way
  assert.match(await get(client, dns, "alpha"), /^HTTP\/1.0 200/);
});

await test("mail: the MX with the lowest preference", async () => {
  assert.deepEqual(await dns.resolveMail("coolsite.sim"), { target: "bravo", via: "mx" });
  assert.deepEqual(await dns.resolveMail("www.coolsite.sim"), { target: "alpha", via: "domain" }, "no MX: the name's own machine");
  assert.deepEqual(await dns.resolveMail("bravo"), { target: "bravo", via: "none" });
});

await test("answers are kept (one question per name), and many callers share one question", async () => {
  let asked = 0;
  const counting = resolverFor(client, { stack: { ...client.stack, resolve: (h) => client.stack.resolve(h), connect: (...a) => { asked++; return client.stack.connect(...a); } } });
  const all = await Promise.all([1, 2, 3, 4].map(() => counting.resolve("www.coolsite.sim")));
  assert.ok(all.every((r) => r.target === "alpha"));
  assert.equal(asked, 1, "four at once: one question");
  await counting.resolve("www.coolsite.sim");
  assert.equal(asked, 1, "kept for its TTL");
  await counting.resolve("nope.coolsite.sim");
  await counting.resolve("nope.coolsite.sim");
  assert.equal(asked, 2, "NXDOMAIN is remembered too");
});

await test("RESOLV.INI: another name server, a search domain, or none", async () => {
  client.write("C:\\SYSTEM\\RESOLV.INI", "nameserver=starthere\nsearch=coolsite.sim\n");
  const d = resolverFor(client);
  assert.deepEqual(d.nameServer(), { server: "starthere", central: false });
  assert.equal((await d.resolve("shop")).target, "alpha", "a single word gets the search domain");
  client.write("C:\\SYSTEM\\RESOLV.INI", "nameserver=none\n");
  const off = resolverFor(client);
  assert.deepEqual(await off.resolve("www.coolsite.sim"), { target: "www.coolsite.sim", canonical: "www.coolsite.sim", viaDns: false });
  client.remove("C:\\SYSTEM\\RESOLV.INI");
});

await test("a name server that's gone: names fall through within a couple of seconds, then at once", async () => {
  client.write("C:\\SYSTEM\\RESOLV.INI", "nameserver=alpha\n"); // ALPHA runs no name server
  const d = resolverFor(client);
  let t = Date.now();
  assert.equal((await d.resolve("www.coolsite.sim")).target, "www.coolsite.sim");
  assert.ok(Date.now() - t < 3000, "gave up in " + (Date.now() - t) + "ms");
  assert.match(d.lastError(), /refused|no answer/);
  t = Date.now();
  assert.equal((await d.resolve("shop.coolsite.sim")).target, "shop.coolsite.sim");
  assert.ok(Date.now() - t < 100, "left alone for a while: " + (Date.now() - t) + "ms");
  client.write("C:\\SYSTEM\\RESOLV.INI", "nameserver=nosuchmachine\n");
  const d2 = resolverFor(client);
  assert.equal((await d2.resolve("www.coolsite.sim")).target, "www.coolsite.sim");
  assert.match(d2.lastError(), /no machine called nosuchmachine/);
  client.remove("C:\\SYSTEM\\RESOLV.INI");
});

net.shutdown();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
