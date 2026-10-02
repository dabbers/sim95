# SimDNS for SIM95 itself: Simxplorer's name resolution, for Voyager

This is Simxplorer's domain-name resolution, packaged for the SIM95
platform: a dependency-free JavaScript module, the wire protocol it speaks,
how it decides things, and where it could plug in. It works today in
Simxplorer, SimPlayer, Vapor, Frostbird, the mail server, the Sim Shell
and AskSim. Each carries the same resolver in SPARK
([`../src/RESOLVE.SPK`](../src/RESOLVE.SPK)). This folder is the same thing
in JavaScript.

| File | What it is |
|---|---|
| [`simdns-resolver.mjs`](simdns-resolver.mjs) | The resolver: `createResolver({ stack, readFile })`, then `await resolve(host)` |
| [`../../tools/aspsim/voyagerdns.test.mjs`](../../tools/aspsim/voyagerdns.test.mjs) | Its tests, against the real bundle's network stack and the real name server on a pretend network |
| [`../src/RESOLVE.SPK`](../src/RESOLVE.SPK) | The same resolver in SPARK, as the apps carry it |
| [`../../simnic/src/NAMED.SPK`](../../simnic/src/NAMED.SPK) | The name server it talks to (BIND-style zones, port 53) |

## The idea

* SIM95 gives each machine exactly one name, held by the central server.
* SimDNS adds names on top: `www.coolsite.sim` is a **CNAME to a machine
  name** (`alpha`), so it survives the addresses changing every session.
* One central name server answers for every domain. On this network that's
  STARTHERE.56k.net, which also runs the registrar.
* A browser looks the name up, connects to the machine, and sends the name
  that was typed in `Host:`. The machine's web server picks the site by it.
* **Anything SimDNS doesn't answer falls through to SIM95's own names,
  unchanged.** That covers plain machine names, addresses, unknown names,
  and a name server that's off or down. Nothing that works today stops
  working.

## The wire protocol (port 53, one message each way)

```
-> QUERY www.coolsite.sim A                 types: A, CNAME, MX, TXT, NS, ANY
<- OK
   www.coolsite.sim 300 CNAME alpha         name ttl type value, one per line
<- NXDOMAIN                                 no such name
<- SERVFAIL <why>
```

* The server follows CNAMEs through its own zones and lists the whole chain:
  `shop → store → www → alpha`.
* A chain that leaves its zones ends at a SIM95 machine name. That's where
  to connect.
* An MX value is `<preference> <machine>`.

## How a name is resolved

1. **Is it SimDNS's to answer at all?** No for:
   * addresses and `localhost`;
   * single words, which are machine names, unless `RESOLV.INI` sets `search=`;
   * the name server itself and this machine;
   * **anything under one of SIM95's ISPs** (`56k.net`, `dialup.zone`,
     `bbs.club`, `modem.link`, `beep.boop`). Those are machines' full names,
     so no DNS record can ever take a machine over. The registrar won't sell
     those domains either.

   All of these go to SIM95 as today.
2. **Which name server?** The central one (`starthere.56k.net`), unless
   `C:\SYSTEM\RESOLV.INI` says `nameserver=<machine>` (or `none`). Its address
   comes from SIM95 once a minute.
3. **Ask:** `QUERY <name> A`.
4. **Read the answer:**
   * Follow the CNAME chain (8 at most) to an `A` address, or to the machine
     name it ends at.
   * Keep the answer for its TTL (5 s at least).
   * Keep `NXDOMAIN` for 60 s.
   * One question per name at a time: callers asking the same name share it.
5. **A server that refuses or is silent for 2 s:** every name goes to SIM95
   for the next 30 s. Nothing ever hangs.
6. **Mail** (`resolveMail`): the MX with the lowest preference, then that
   name. With no MX, the domain's own machine.

## Using it

```js
import { createResolver } from "./simdns-resolver.mjs";

const dns = createResolver({
  stack,                                                  // the bundle's Stack
  readFile: (p) => (disk.exists(p) ? disk.read(p) : null), // for RESOLV.INI
  hostname: () => stack.hostname(),
});

const { target, viaDns } = await dns.resolve("www.coolsite.sim"); // "alpha", true
const conn = await stack.connect(pid, target, 80);
conn.send("GET / HTTP/1.0\nHost: www.coolsite.sim");             // the typed name
```

## Where it could plug in

**A. In the kernel's name lookup.** This is the big win: every program gets
domain names for free.

* If the stack resolved names through this before asking the central
  server, `NET.Resolve("www.coolsite.sim")` and
  `Connect("www.coolsite.sim", 80)` would just work in every SPARK program,
  and in Voyager.
* Programs already send the name they were given in `Host:`, so web servers
  would pick the right site with no change.
* The resolvers bundled into our apps would then be harmless duplicates.
* The resolver checks its own exclusions first, so plain machine names
  never pay a round trip. Names with dots (`bob.56k.net`) are excluded by
  the ISP rule.

**B. In Voyager only**, like Simxplorer does it. Before connecting for a
page, a picture or a form post:

* `const { target } = await dns.resolve(host)`, then connect to `target`.
* Keep **`Host:`, the address bar and the cookie jar** on the typed name.
  Cookies for `www.coolsite.sim` belong to that site, not to `alpha`.
* A status line, "Looking up www.coolsite.sim...", is a nice touch.

Without either, Voyager users can still reach these sites. simweb's web
server answers `http://alpha/www.coolsite.sim/` ("path mode") for them.

## Platform bugs we found on the way

These are reproduced in `tools/aspsim`, which runs the real bundle in Node.

1. **A caught failed wait spoils the rest of the handler.**
   * **Symptom:** `TRY / CATCH` around a `Connect` to nobody catches the
     error. Then the next `SYS.Sleep`, or the interpreter's own pause every
     512 statements, throws the same error again, outside the `TRY`.
   * **Cause:** in the task runner, a rejected wait replaces `s.gen` with a
     wrapper that throws, and never puts the original back.
   * **Fix:** restore it as it's used:
     `next: () => { s.gen = u; return u.throw(c); }` (and the same for
     `throw`).
   * Full write-up: [`SIM95-NOTES.md`](../../SIM95-NOTES.md).
2. **Two lookups of one name at once lose the first.** The stack keeps one
   waiter per name. A second `NET.Resolve("bravo")`, or
   `Connect("bravo", 80)`, while one is out leaves the first waiting forever,
   with no timeout. The resolver above shares one question per name for
   that reason.
3. **A close can overtake the last message.** When answers on several
   connections arrive in the same instant, one connection's `close` can be
   handed on before its last message, and the message is dropped.
   * Downloads in several parts, like GETVAPOR, now check sizes and refetch
     because of it.
   * Seen with a server answering three requests in one millisecond.

## Tests

```
node tools/aspsim/voyagerdns.test.mjs
```

The tests boot a central `STARTHERE.56k.net` running the real `NAMED.SPK`,
a web machine running simweb's Host-aware server, and a client with no
settings at all. They check:

* CNAMEs straight to machines, CNAME chains, A records;
* fall-through for everything SimDNS doesn't own, ISP names included;
* a real page fetched by name;
* MX;
* answer caching, and one question shared by many callers;
* `RESOLV.INI`;
* giving up on a dead name server within 2 s.
