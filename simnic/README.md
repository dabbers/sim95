# SimDNS

Domain names for the SIM95 network. Get `www.coolsite.sim` and point it at
your machine, the way everybody was doing in 1996.

Every SIM95 machine has exactly one name on the network, and nothing can give
it another (see [SIM95-NOTES](../SIM95-NOTES.md)). Its address changes every
time it starts. So SimDNS doesn't hand out addresses. It keeps names that
point at **machine names**, with CNAME records:

```
www.coolsite.sim.   300   IN   CNAME   alpha
```

and whoever asks then finds ALPHA the ordinary SIM95 way.

It comes in five parts:

| Part | File | What it is |
|------|------|------------|
| The name server | `C:\PROGRAMS\NAMED.SPK` | BIND's `named`, more or less: answers questions about the zones in `C:\DNS` on port 53. |
| The resolver | `C:\PROGRAMS\RESOLVE.SPK` | A library that asks the name server set in `C:\SYSTEM\RESOLV.INI`. Simxplorer and DIG have it built in. |
| DIG | `C:\PROGRAMS\DIG.SPK` | Ask a name server about a name, from the Terminal or the Sim Shell. |
| The web server | `C:\PROGRAMS\HTTPD.SPK` | The stock one, plus virtual hosts: many sites on one machine, by name or by path. |
| SimNIC | `C:\WEB` (or `C:\WEB\DNS`) | The registrar, a 1996 InterNIC: sign up, register `coolsite.sim`, edit its records, Host it here. |

## Installing

Paste [`INSTALL.SPK`](INSTALL.SPK) into SPARK on the machine that will be the
name server, save it as `C:\MYFILES\INSTALL.SPK` and press **F5**. It:

* writes `C:\DNS\NAMED.CNF` (no zones yet), starts `NAMED.SPK`, and adds
  `C:\SYSTEM\STARTUP\NAMED.RUN` so it starts with the machine;
* makes SimNIC the home page (the stock `INDEX.HTM` moves to `WELCOME.HTM`),
  or puts it in `/dns/` on a [SimHost](../simhost/) machine;
* keeps the stock web server as `C:\PROGRAMS\HTTPD.ORG`, writes the new
  `HTTPD.SPK`, and restarts the web server (if it was running; if the web
  server is switched off in Settings it stays off);
* writes `C:\WEB\VHOSTS.TXT` and `C:\WEB\SITES` for hosted sites, and
  `C:\SYSTEM\RESOLV.INI` saying this machine is its own name server.

Accounts and domains (`C:\NICDATA`) and zones (`C:\DNS`) are left alone, so
running it again upgrades SimDNS. It's on Vapor's shelves too. **Uninstall**
there removes it, and within a second the web server notices
`NAMED.SPK` has gone and puts the stock `HTTPD.ORG` back. (The web server
itself is left out of the installer's file list, so no Vapor can ever delete
it.)

## Two machines: setting it up

ALPHA will be the name server and host the site; BRAVO is somebody browsing.

1. **On ALPHA**, install SimDNS as above. Open `http://alpha/` (SimNIC).
2. **Sign up**, search for `coolsite`, and press **Register coolsite.sim**.
3. On the domain's page press **Host it here**. ALPHA now has a folder for the
   site (`C:\WEB\SITES\COOLSITE`, with a "Coming soon!" page), the web
   server serves it for `coolsite.sim` and `www.coolsite.sim`, and both names
   are CNAMEs to `alpha`. Put your pages in that folder.
4. **On BRAVO**, tell it where the name server is, either way:
   * Simxplorer: **View, Options**, *Name server:* `alpha`, OK; or
   * the Terminal: `DIG SET alpha` (DIG needs SimDNS installed, or copy
     `C:\PROGRAMS\DIG.SPK` over); or
   * write `C:\SYSTEM\RESOLV.INI` yourself: `nameserver=alpha`.

   That one file is all a machine needs to look names up. Every program on
   BRAVO that uses the resolver reads it.
5. **On BRAVO**, open `http://www.coolsite.sim/` in Simxplorer. The status bar
   says *Looking up www.coolsite.sim...*, then *Connecting to alpha...*.
6. Voyager doesn't know name servers, but the same site is at
   `http://alpha/www.coolsite.sim/` for anybody.

A third machine with its own SimDNS can answer for a part of your domain
(`east NS charlie` in your records), or pass every question it can't answer
to yours (`forwarders alpha` in its `NAMED.CNF`).

## Zone files

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

## The resolver: RESOLVE.SPK and RESOLV.INI

```
nameserver=alpha
search=coolsite.sim        (optional: then "www" means www.coolsite.sim)
```

`RESOLVE.SPK` is a library. Programs have it joined on the end (the builder
does this for Simxplorer and DIG), and every name in it starts with `Rs`. It
answers *where do I connect for this name?*:

* A name the name server knows comes back as the machine (or address) at the
  end of its CNAMEs. Answers are kept for their TTL.
* Plain machine names (`alpha`), addresses, and names the name server says
  NXDOMAIN to go to SIM95's own lookup, as they always did.
* If the name server refuses, or doesn't answer within 2 seconds, it is left
  alone for 30 seconds, and every name goes to SIM95. Nothing hangs.

To use it in your own program (it must ask from a timer tick, because of the
kernel bug in [SIM95-NOTES](../SIM95-NOTES.md)):

```
' in a timer tick, in a TRY with an empty CATCH:
IF RsBusy() THEN RETURN                ' an answer is on its way
IF RsWants(host) THEN
    addr = NET.Resolve(RsNameServer())
    IF addr = "" THEN
        RsGiveUp("no such machine")     ' names go to SIM95 for a while
    ELSE
        RsAsk(host, addr)               ' a Connect: the last thing
        RETURN
    END IF
END IF
conn = sock.Connect(RsTarget(host), 80) ' alpha, for www.coolsite.sim
```

## DIG

```
DIG www.coolsite.sim               the CNAMEs, and where the machine is
DIG coolsite.sim MX                (A CNAME MX TXT NS SOA ANY)
DIG www.coolsite.sim ANY @bravo    ask BRAVO's name server instead
DIG SET alpha                      make ALPHA this machine's name server
DIG SET NONE                       machine names only
```

```
; <<>> DiG 2.1 for SIM95 (SimDNS) <<>> shop.coolsite.sim A
;; ->>HEADER<<- status: NOERROR, answers: 2

;; QUESTION SECTION:
;shop.coolsite.sim.              IN  A

;; ANSWER SECTION:
shop.coolsite.sim.       300    IN  CNAME  www.coolsite.sim
www.coolsite.sim.        300    IN  CNAME  alpha

;; alpha is a SIM95 machine name: 65.16.0.3 (asked SIM95, not SimDNS)

;; Query time: 56 msec
;; SERVER: alpha (65.16.0.3) port 53
```

## The web server: one machine, many sites

`C:\WEB\VHOSTS.TXT`, one site a line (folders must be in `C:\WEB`):

```
www.coolsite.sim|C:\WEB\SITES\COOLSITE
coolsite.sim|C:\WEB\SITES\COOLSITE
*.dab.sim|C:\WEB\SITES\DAB
book.dab.sim|C:\WEB\BOOK
```

A site is reached two ways:

* **By name** (Simxplorer with a name server): the request's `Host:` says
  `www.coolsite.sim`, and `/page.htm` is that folder's `PAGE.HTM`.
* **By path** (Voyager, or anybody): `http://alpha/www.coolsite.sim/page.htm`
  is the same file, and `/www.coolsite.sim` gets its slash added.

Anything else, including the machine's own name, an address, and names not
listed, is `C:\WEB` exactly as before: ASP pages, `INDEX.ASP` when there's no
`INDEX.HTM`, POSTs, content types, the log window. It is the stock
`HTTPD.SPK` with sites added.

**What a server page in a site sees:** `SERVER.ScriptName` is its file on
disk, and imports are next to it, as always. `REQUEST.Path` is the path
*inside the site* (`/page.asp`) both ways, so relative links work both ways.
`REQUEST.Host` is what the browser asked for: `www.coolsite.sim` by name,
`alpha` by path. Two headers say the rest:

| Header | By name | By path |
|--------|---------|---------|
| `X-Site` | `www.coolsite.sim` | `www.coolsite.sim` |
| `X-Base-Path` | `/` | `/www.coolsite.sim/` |

so a page's own address is `"http://" + REQUEST.Host + REQUEST.Header("X-Base-Path") + "page.asp"`.
A `RESPONSE.Redirect("/x.asp")` is put back inside the site by path. Links
starting with `/` can't be, so **in a site, use relative links**. That is what
every web app here already does, for SimHost's folders.

## SimNIC

`/` (or `/dns/`), a parody of InterNIC's 1996 Registration Services:

* **Contacts** (accounts) with salted, hashed passwords, a `simnic` cookie,
  and form tokens on everything that changes something, as SimBook does.
* **Search:** `coolsite` is looked up under `.sim`, `.com`, `.net` and `.org`.
  **WHOIS** says who has a name.
* **Register:** free, unless this machine has SimPal (`C:\PALDATA`,
  `C:\PROGRAMS\PALCHECK.SPK`, and a SimPal account called `simnic` for the
  money). Then it's **§70.00 for two years**, like 1996: the name is held for
  15 minutes while you pay at SimPal, and `paid.asp` checks the receipt with
  `PALCHECK.SPK` before the name is yours. Ten domains per contact.
* **Records:** a form with CNAME already chosen and this machine's name
  already filled in. Also A, MX, TXT and NS. Up to 40 records a domain.
  SimNIC writes `C:\DNS\<DOMAIN>.<TLD>` and its line in `NAMED.CNF`. The name
  server has the change within 3 seconds.
* **Host it here:** a folder in `C:\WEB\SITES`, lines in `VHOSTS.TXT` for the
  domain and its `www`, and CNAMEs to this machine. Both addresses are shown.
* **On a SimHost machine:** *Point these names at the apps* gives every app
  a name in your domain: `book.dab.sim` is SimBook (`C:\WEB\BOOK`),
  `mail.dab.sim` ColdMail, and so on. Simxplorer users then get each app as a
  separate site, with its own cookies.

```
C:\NICDATA\USERS\<user>.TXT     a contact
C:\NICDATA\SESSIONS\<id>.TXT    a sign-in and its form token
C:\NICDATA\DOMAINS.TXT          domain|owner|registered|expires|zone file|active (or unpaid)
C:\NICDATA\ORDERS\<order>.TXT   a registration being paid for
C:\DNS\NAMED.CNF, C:\DNS\*.*    the zones
C:\WEB\VHOSTS.TXT, C:\WEB\SITES the hosted sites
```

## Limits

* One forwarder, one hop: a question passed on is never passed on again.
* A CNAME whose target is in another server's zone is handed to SIM95 as a
  machine name; to point at a name elsewhere, point at its machine.
* Voyager can only use path addresses. Two programs on one machine looking
  up the same machine name at the same moment still meet the SIM95 bug in
  [SIM95-NOTES](../SIM95-NOTES.md); the resolver itself only connects to
  addresses.
* Move In (SimHost) doesn't bring `C:\DNS` or `C:\NICDATA` over.

Tests: `node tools/aspsim/simdns.test.mjs`. They cover:

* zones: CNAMEs to machines and chains of them, A, MX, TXT, NS, SOA, ANY,
  wildcards, NXDOMAIN, loops and bad lines;
* loading again when files change, forwarding, NS hand-offs and NORECURSE;
* answers too big for a message;
* DIG, and the resolver's cache and what it does when the name server is
  down;
* Simxplorer on BRAVO opening `www.coolsite.sim` on ALPHA through DNSBOX's
  name server: relative links, a picture, an XMLHttpRequest and a cookie;
* path mode through the real web server;
* every app (SimBook, ColdMail, AskSim's crawler, SimPal, SimTube, SimStats,
  Vapor) through the new web server on a SimHost machine;
* SimNIC: signing up, registering, records, Host it here, CSRF, SimPal
  payment, and SimBook at `book.dab.sim`;
* uninstalling, which brings the stock web server back.

`SIM95_HTTPD=simdns/src/HTTPD.SPK node tools/aspsim/<app>.test.mjs` runs any
other suite with this web server in place of the stock one.
