# SimNIC

Domain names for the SIM95 network. Get `www.coolsite.sim` and point it at
your machine, the way everybody was doing in 1996.

There is **one** SimNIC, on the central host, **STARTHERE.56k.net** (SIM95
finds it as plain `STARTHERE` too). It is the registrar, a 1996 InterNIC,
and the name server every machine on the network asks about names, with no
setting anywhere. Nobody else runs one.

Every SIM95 machine has exactly one name on the network, and nothing can give
it another (see [SIM95-NOTES](../SIM95-NOTES.md)). Its address changes every
time it starts. So SimNIC doesn't hand out addresses. It points names at
**machine names**, with CNAME records:

```
www.coolsite.sim.   300   IN   CNAME   alpha
```

and whoever asks then finds ALPHA the ordinary SIM95 way.

## Who installs what

| Where | What | Why |
|-------|------|-----|
| STARTHERE.56k.net, once | **SimNIC** (this): `NAMED.SPK` and the registrar at `/nic/` | The network's one registrar and name server. |
| Every machine with a web site | **[simweb](../simweb/)**, from any Vapor store | Its web server serves sites by name; Personal Web Manager says which pages each name gets. |
| Everybody else | nothing | Simxplorer, Vapor, Frostbird, ColdMail, the Sim Shell and AskSim all ask STARTHERE already. |

A site at a name needs **two things, in two places**:

1. **Here, at SimNIC:** the name points to your machine.
2. **On your machine, in Personal Web Manager:** the name gets your pages
   (or one of your apps).

## Getting a name, step by step

ALPHA has the pages; BRAVO is somebody browsing.

1. **Register at SimNIC.** Open `http://starthere.56k.net/nic/`, **sign up**,
   search for `coolsite`, and press **Register coolsite.sim**. (It's free,
   unless STARTHERE has SimPal: see below.)
2. **Point the domain at your machine.** The domain's page starts with one
   box: *coolsite.sim points to machine:* `alpha`, **Save**. SimNIC points
   `coolsite.sim` and `www.coolsite.sim` at ALPHA. The next domain you
   register starts with the same machine filled in.
3. **Add the site on ALPHA.** Install [simweb](../simweb/) from Vapor, open
   **Personal Web Manager**, **Web Sites, Add...**: `coolsite.sim`, *also
   www.*, *My own pages*. Your pages go in `C:\WEB\SITES\COOLSITE`; there is
   an *Under construction* page there to start with. Its DNS column says
   *✓ points here* once step 2 is done.
4. **Browse.** On BRAVO, Simxplorer opens `http://coolsite.sim/`: the status
   bar says *Looking up coolsite.sim...*, then *Connecting to alpha...*.
   Voyager doesn't know names, but the same site is at
   `http://alpha/coolsite.sim/` for anybody.

**Advanced DNS**, below the box, is for everything else: more names under
your domain (`book CNAME alpha`, or `* CNAME alpha` for all of them), mail
(`@ MX 10 alpha`, to get mail at your domain with [ColdMail](../coldmail/)),
`TXT` lines, and `A` records (addresses change when a machine restarts, so
prefer CNAME). Up to 40 records a domain. **WHOIS** says who has a name and
which machine it points to.

## Installing (on STARTHERE.56k.net)

Paste [`INSTALL.SPK`](INSTALL.SPK) into SPARK on STARTHERE.56k.net, save it
as `C:\MYFILES\INSTALL.SPK` and press **F5**. It isn't in any Vapor store:
it is run once, by hand, on the one machine. On any other machine it warns
*SimNIC is meant to run only on the central host* and asks before going on
(for testing, say). It:

* writes `C:\DNS\NAMED.CNF` (no zones yet), starts `NAMED.SPK`, and adds
  `C:\SYSTEM\STARTUP\NAMED.RUN` so it starts with the machine;
* puts the registrar in `C:\WEB\NIC`: `http://starthere.56k.net/nic/`, the
  address every Personal Web Manager gives. On a [SimHost](../simhost/)
  machine the front page lists it. The home page and the web server are left
  alone: the stock one serves `/nic/` fine.

Accounts and domains (`C:\NICDATA`) and zones (`C:\DNS`) are left alone, so
running it again upgrades SimNIC.

To move the network's central host somewhere else, change `CENTRAL` in
`tools/simxplorer-source.mjs` and rebuild the installers: it is the default
name server in the resolver every program carries, and the address SimNIC's
installer and Personal Web Manager give.

## SimNIC, the registrar

A parody of InterNIC's 1996 Registration Services, at `/nic/`:

* **Contacts** (accounts) with salted, hashed passwords, a `simnic` cookie,
  and form tokens on everything that changes something, as SimBook does.
* **Search:** `coolsite` is looked up under `.sim`, `.com`, `.net` and `.org`.
* **Register:** free, unless this machine has SimPal (`C:\PALDATA`,
  `C:\PROGRAMS\PALCHECK.SPK`, and a SimPal account called `simnic` for the
  money). Then it's **§70.00 for two years**, like 1996: the name is held for
  15 minutes while you pay at SimPal, and `paid.asp` checks the receipt with
  `PALCHECK.SPK` before the name is yours. Ten domains per contact.
* **Points to machine:** CNAMEs for the domain and its `www` (an empty box
  points it nowhere). **Advanced DNS:** CNAME, MX, TXT and A records.
  SimNIC writes `C:\DNS\<DOMAIN>.<TLD>` and its line in `NAMED.CNF`. The name
  server has the change within 3 seconds.
* **Hosting is not SimNIC's job.** It never touches `C:\WEB\VHOSTS.TXT` or
  makes site folders: that is Personal Web Manager's, on each web server.

```
C:\NICDATA\USERS\<user>.TXT     a contact (and machine=, the last machine pointed at)
C:\NICDATA\SESSIONS\<id>.TXT    a sign-in and its form token
C:\NICDATA\DOMAINS.TXT          domain|owner|registered|expires|zone file|active (or unpaid)
C:\NICDATA\ORDERS\<order>.TXT   a registration being paid for
C:\DNS\NAMED.CNF, C:\DNS\*.*    the zones
```

## Zone files

SimNIC writes these for every domain it registers; on STARTHERE they can be
written by hand too (with Notes), and `NAMED.SPK` reads them all the same.

`C:\DNS\NAMED.CNF` lists the zones, BIND 4 `named.boot` style:

```
; NAMED.CNF
directory   C:\DNS
primary     coolsite.sim   COOLSITE.SIM
primary     toys.com       TOYS.COM
forwarders  dnsbox
```

`forwarders` is where questions about other names go (the first one listed).
Without it, they get NXDOMAIN. A zone file is BIND's format, the parts SIM95
needs:

```
; COOLSITE.SIM
$TTL 300
@        IN  SOA    alpha hostmaster ( 1996070401 )
@        IN  NS     alpha
@        IN  CNAME  alpha             ; coolsite.sim is on ALPHA
www      IN  CNAME  alpha             ; and so is www.coolsite.sim
shop         CNAME  www               ; shop -> www -> alpha
mirror       CNAME  www.toys.com.     ; a name somewhere else
*.users      CNAME  bravo             ; ann.users.coolsite.sim, bob.users...
@            MX     10 alpha          ; mail for coolsite.sim goes to ALPHA
@            TXT    "Best viewed in Simxplorer"
east         NS     charlie           ; east.coolsite.sim is CHARLIE's to answer
old          A      65.16.0.7         ; an address (it goes stale!)
```

* **CNAME is the record to use.** Its target is a machine name (`alpha`) or
  another name. A single word is a name in this zone if the zone has it
  (`shop CNAME www`), and otherwise a SIM95 machine (`www CNAME alpha`). A name
  with dots is taken as it is; a last dot is fine either way. The name server
  follows CNAMEs through its own zones, up to 8 of them (a loop is a
  SERVFAIL), and a chain that ends at a name it doesn't know ends at a
  machine.
* **A** takes an address. It works, but SIM95 addresses change whenever a
  machine starts, so it is only there just in case.
* **MX** is a preference and a mail machine; **TXT** is a line of text in
  quotes; **NS** names the machine whose SimDNS answers for a part of the
  zone; **SOA** is read but not used. `$TTL` sets the time to live
  (an hour if not given), and a number before the type sets one record's.
* As in BIND, `@` is the zone itself, a line that starts with a space is
  about the name above it, `;` starts a comment, and `( ... )` can run over
  several lines. Unlike BIND, a CNAME may sit at `@` beside the SOA and NS
  (questions about those still get them).

`NAMED.SPK` looks at its files every 3 seconds and loads them again when they
have changed (SPARK can't see file times, so it compares the text). Problems
(`COOLSITE.SIM line 18: A needs an address like 65.16.0.2`) are shown in its
window, and the bad line is left out.

## The protocol

Port 53, one question a message, one answer a message:

```
QUERY www.coolsite.sim A          ->  OK
                                      www.coolsite.sim 300 CNAME alpha
QUERY shop.coolsite.sim           ->  OK
                                      shop.coolsite.sim 300 CNAME www.coolsite.sim
                                      www.coolsite.sim 300 CNAME alpha
QUERY nope.coolsite.sim A         ->  NXDOMAIN
QUERY loop.coolsite.sim A         ->  SERVFAIL more than 8 CNAMEs in a row from loop.coolsite.sim (a loop?)
```

The type is A, CNAME, MX, TXT, NS, SOA or ANY (A if left out). An answer is
`OK` and one `name ttl type value` line per record, `NXDOMAIN`, or `SERVFAIL`
and why. An answer that wouldn't fit in one 64K message is a SERVFAIL. A
fourth word, `NORECURSE`, means "your own zones only": that is how one SimDNS
asks another, so two that forward to each other can't pass a question round
forever.

## Limits

* One forwarder, one hop: a question passed on is never passed on again.
* A CNAME whose target is in another server's zone is handed to SIM95 as a
  machine name; to point at a name elsewhere, point at its machine.
* If STARTHERE is down, names don't work anywhere (programs notice within 2
  seconds and go on with machine names); machine names always work.
* Move In (SimHost) doesn't bring `C:\DNS` or `C:\NICDATA` over.

Tests: `node tools/aspsim/simnic.test.mjs`. They cover:

* zones: CNAMEs to machines and chains of them, A, MX, TXT, NS, SOA, ANY,
  wildcards, NXDOMAIN, loops and bad lines; loading again when files change,
  forwarding, NS hand-offs and NORECURSE; answers too big for a message;
* the installer: the warning anywhere but STARTHERE.56k.net, and on it,
  NAMED running, `/nic/`, and the web server and home page left alone;
* SimNIC: signing up, registering, the *points to machine* field (and the
  machine remembered), Advanced DNS, WHOIS, CSRF and other people's domains,
  the limits, SimPal payment, and no vhosts or site folders written, ever;
* SimNIC on a SimHost machine, on the front page at `/nic/`.

The resolver, `DIG` and the web server are [simweb](../simweb/)'s, with their
own tests.
