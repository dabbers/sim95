# simweb

For every machine with a web site: a web server that serves **many sites by
name**, and **Personal Web Manager** to say which pages each name gets. One
machine can be `coolsite.sim` (your own pages), `coolbook.sim` (its SimBook)
and `book.coolsite.sim` all at once. It's on every Vapor store's shelves.

Names themselves are registered, and pointed at your machine, at
[SimNIC](../simnic/), the network's one registrar, on the central host
STARTHERE.56k.net. That is the other half: a name needs **both**.

| Where | What |
|-------|------|
| STARTHERE.56k.net, once | [SimNIC](../simnic/): the registrar and the name server everybody asks |
| Every machine with a web site | **simweb** (this) |
| Everybody else | nothing: every program asks STARTHERE already |

simweb is:

| Part | File | What it is |
|------|------|------------|
| Personal Web Manager | `C:\PROGRAMS\PWM.SPK` | Windows 98's, more or less: this machine's sites, its apps' names, and the web server's Start and Stop. |
| The web server | `C:\PROGRAMS\HTTPD.SPK` | The stock one, plus sites by name (`C:\WEB\VHOSTS.TXT`), and by path for Voyager. |
| DIG | `C:\PROGRAMS\DIG.SPK` | Ask the name server about a name, from the Terminal. |
| The resolver | `C:\PROGRAMS\RESOLVE.SPK` | The library every program that looks names up has joined on, for your own programs. |

## A site at a name, step by step

1. **Register at SimNIC:** `http://starthere.56k.net/nic/`, sign up, and
   register `coolsite.sim`.
2. **Point the domain at your machine,** on the domain's page at SimNIC:
   *coolsite.sim points to machine:* `alpha`, **Save**.
3. **Add the site in Personal Web Manager** on ALPHA: **Web Sites,
   Add...**, `coolsite.sim`, *also www.*, and what it serves:
   * **My own pages:** a folder of its own, `C:\WEB\SITES\COOLSITE`, with an
     *Under construction* page in it to start you off; or
   * **a web app on this machine** (one in a folder of its own, as
     [SimHost](../simhost/) puts them): `coolbook.sim` is SimBook; or
   * **this machine's home page** (`C:\WEB`).
4. **Browse:** Simxplorer, anywhere, opens `http://coolsite.sim/`. Voyager
   doesn't know names, but the same site is at `http://alpha/coolsite.sim/`.
   Personal Web Manager shows both addresses for the site you pick.

## Installing

From Vapor (it's on every store's shelves), or paste
[`INSTALL.SPK`](INSTALL.SPK) into SPARK, save it as `C:\MYFILES\INSTALL.SPK`
and press **F5**. It:

* keeps the stock web server as `C:\PROGRAMS\HTTPD.ORG`, writes the new
  `HTTPD.SPK`, and restarts the web server (if it was running; if the web
  server is switched off in Settings it stays off);
* writes `C:\WEB\VHOSTS.TXT` (comments only) and makes `C:\WEB\SITES`;
* writes Personal Web Manager, DIG and the resolver, and opens Personal Web
  Manager.

Nothing needs setting up for names: with no `C:\SYSTEM\RESOLV.INI` the name
server is STARTHERE.56k.net. Your sites (`VHOSTS.TXT`, `C:\WEB\SITES`) are
left alone, so running it again upgrades simweb.

**Uninstall** it in Vapor, and within a second the web server notices
`PWM.SPK` has gone and puts the stock `HTTPD.ORG` back. (The web server
itself is left out of the installer's file list, so no Vapor can ever
delete it.)

## Personal Web Manager

A 1998 Personal Web Manager: a teal *View* bar down the left with **Main**,
**Web Sites** and **Domain Apps**, and the same under the **View** menu. It's
for the machine's owner, so there is no password.

* **Main:** *Web publishing is on. Your home page is available at
  http://alpha/*, with **Stop** (or **Start**) and **Restart**, as PWS's
  publishing button had; how many sites there are; and where SimNIC is,
  with a **Register / point it at SimNIC** button that opens
  `http://starthere.56k.net/nic/` in Simxplorer (or Voyager).
* **Web Sites:** the machine's sites, one a row: the name (`+www` when
  `www.` is there too), what it serves, and what the name server says about
  the name:
  * *✓ points here*: Simxplorer users reach it;
  * *points at bravo*: the name leads somewhere else (change it at SimNIC);
  * *not registered*: nobody has that name at SimNIC (or there is no such
    name under your domain: add a CNAME in Advanced DNS);
  * *name server not answering*: STARTHERE is down, or switched off in
    `RESOLV.INI` (*no name server*).

  **Add...**, **Edit...** and **Remove** (which leaves the folder and its
  pages where they are), and **Check DNS** to ask again. Pick a site to see
  its two addresses.
* **Domain Apps** (*Name my apps under a domain*): type `coolsite.sim`, tick
  the apps that should have a name under it, and change their labels if you
  like (they start as `book`, `mail`...). **Save** adds `book.coolsite.sim`
  and so on for the ticked ones and takes away the unticked ones' names,
  and touches nothing else. Each name must point here at SimNIC too: a CNAME
  each in Advanced DNS (`book CNAME alpha`), or one `* CNAME alpha` for all.

## The web server: one machine, many sites

`C:\WEB\VHOSTS.TXT`, one site a line (folders must be in `C:\WEB`). Personal
Web Manager keeps it, and leaves alone any line it doesn't know (comments,
`*.` names), so it can be edited by hand too:

```
www.coolsite.sim|C:\WEB\SITES\COOLSITE
coolsite.sim|C:\WEB\SITES\COOLSITE
*.dab.sim|C:\WEB\SITES\DAB
book.dab.sim|C:\WEB\BOOK
```

A site is reached two ways:

* **By name** (Simxplorer, and every program here): the request's `Host:` says
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

## The resolver: RESOLVE.SPK and RESOLV.INI

Every program that looks names up has `RESOLVE.SPK` joined on the end by the
builder: Simxplorer (and the SimPlayer built into it, which shares the
browser's copy), SimPlayer, Vapor, Frostbird, ColdMail's `MAILD.SPK`, the Sim
Shell, AskSim's crawler, DIG and Personal Web Manager. Every name in it starts
with `Rs`. It answers *where do I connect for this name?*:

* The name server is **STARTHERE.56k.net**, unless `C:\SYSTEM\RESOLV.INI`
  says otherwise. Nothing has to be set.
* A name the name server knows comes back as the machine (or address) at the
  end of its CNAMEs. Answers are kept for their TTL.
* Plain machine names (`alpha`), addresses, and names the name server says
  NXDOMAIN to go to SIM95's own lookup, as they always did.
* If the name server refuses, or doesn't answer within 2 seconds, it is left
  alone for 30 seconds, and every name goes to SIM95. Nothing hangs.

`C:\SYSTEM\RESOLV.INI`, all optional, shared by every program on the machine
(Simxplorer's **View, Options** and `DIG SET` write it):

```
nameserver=dnsbox          another name server instead of the central one
nameserver=none            no SimDNS: machine names only
search=coolsite.sim        then "www" means www.coolsite.sim
```

The central host is `RSCENTRAL`, a constant at the top of `RESOLVE.SPK`. The
builder fills it in from `CENTRAL` in `tools/simxplorer-source.mjs`, so
moving the network's central host is a one-line change and a rebuild.

To use it in your own program, ask from a timer tick (because of the kernel
bug in [SIM95-NOTES](../SIM95-NOTES.md)): one line, then connect to
`RsTarget`, and keep sending the name as typed in `Host:`:

```
' in a timer tick, in a TRY with an empty CATCH, nothing after END TRY:
IF RsNext(host) THEN RETURN             ' asked (a Connect: the last thing), or waiting
conn = sock.Connect(RsTarget(host), 80) ' alpha, for www.coolsite.sim
conn.Send("GET / HTTP/1.0" + EOL + "Host: " + host)
```

and for mail, `RsNextMail(domain)` and `RsMailTarget(domain)`: the MX with
the lowest preference, else the domain's own machine, else the name itself.

## DIG

```
DIG www.coolsite.sim               the CNAMEs, and where the machine is
DIG coolsite.sim MX                (A CNAME MX TXT NS SOA ANY)
DIG www.coolsite.sim ANY @bravo    ask BRAVO's name server instead
DIG SET                            which name server is it?
DIG SET alpha                      make ALPHA this machine's name server
DIG SET NONE                       machine names only
DIG SET DEFAULT                    the central one again
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
;; SERVER: starthere.56k.net (65.16.0.2) port 53
```

The Sim Shell's `host` (and `nslookup`) prints the same.

## Domain names in the programs

With a name server answering for a name, each program connects to the
machine it names and keeps sending the name as typed (as `Host:` for the web),
so a web server with sites finds the right one. With no answer, or the name
server down, the name is a SIM95 machine name, as always, within 2 seconds.

* **Simxplorer** and its built-in **SimPlayer**: pages, pictures, scripts'
  requests and movies at `http://coolsite.sim/`.
* **SimPlayer** on its own: a movie at a name.
* **Vapor:** a store at a name (**Change Store...** `fun.sim`, or
  `http://shop.fun.sim/vapor/`): the catalog, downloads, and Vapor's own
  updates.
* **Frostbird:** `ann@fun.sim` collects her mail from fun.sim's MX (the lowest
  preference), else its machine, else a machine called `fun.sim`.
* **ColdMail's MAILD:** mail to `bob@post.sim` goes the same way, with the
  spool and its retries as before; and it takes mail for a domain whose MX
  points at it (or that `C:\MAILDATA\DOMAINS.TXT` lists).
* **The Sim Shell:** `ssh`, `scp`, `sim-get store fun.sim`, and `host`.
* **AskSim's crawler** follows links to sites by name, keeps them under the
  name, minds each site's own `robots.txt`, and crawls a site by path
  (`http://alpha/www.fun.sim/`) under its name instead, never twice.

**Unchanged, machine names only:** GETVAPOR and GETMAIL (Vapor's and
ColdMail's download-by-Voyager pages), SimHost's Move In, and Clippy.

## Limits

* Voyager can only use path addresses. Two programs on one machine looking
  up the same machine name at the same moment still meet the SIM95 bug in
  [SIM95-NOTES](../SIM95-NOTES.md); the resolver itself only connects to
  addresses.
* A server page that writes links starting with `/` breaks the path address;
  every web app here uses relative links.
* Stop in Personal Web Manager stops the web server until Start (or the
  machine restarts); to keep it off, switch it off in Settings.

Tests: `node tools/aspsim/simweb.test.mjs` covers the installer, DIG and the
resolver with no `RESOLV.INI` at all, Personal Web Manager (adding, editing
and removing sites, own pages or an app or the home page, www., the apps'
names under a domain, the DNS column's answers, Start and Stop), the web
server by name and by path, the whole thing end to end (STARTHERE.56k.net
with SimNIC, WEB with simweb, a client's Simxplorer opening `coolsite.sim`
and `coolbook.sim`), every web app through the new web server, and
uninstalling. `node tools/aspsim/dnsapps.test.mjs` covers the programs above.
`SIM95_HTTPD=simweb/src/HTTPD.SPK node tools/aspsim/<app>.test.mjs` runs any
other suite with this web server in place of the stock one.
