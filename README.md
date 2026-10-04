# sim95
A series of programs for the sim95 playground

* [`simbook/`](simbook/) – SimBook, a tiny early-Facebook-style social network
  written in SPARK ActiveSparkPages.
* [`coldmail/`](coldmail/) – ColdMail, a mail server and webmail that send
  real mail between SIM95 machines.
* [`frostbird/`](frostbird/) – Frostbird, a desktop mail program for ColdMail
  (folders, letters, Get Mail, Write, Reply, Forward).
* [`clippy/`](clippy/) – Clippy, an assistant who watches what you do and
  offers to help ("It looks like you're writing a letter...").
* [`vapor/`](vapor/) – Vapor, a games store and library (downloads, play
  time, achievements), with SimDOOM (a raycast 3D shooter) and Snake 95.
* [`asksim/`](asksim/) – AskSim, an Ask Jeeves-style search engine with a
  real crawler that goes round every machine's web pages.
* [`geosimies/`](geosimies/) – GeoSimies, free GeoCities-style homepages in
  neighborhoods, with a page editor, clip art, hit counters, guestbooks and
  webrings.
* [`wikisim/`](wikisim/) – WikiSim, a 1996 CD-ROM-style encyclopedia: 619
  Wikipedia articles, cut back to what was known in 1996.
* [`eliza/`](eliza/) – ELIZA-95, an ELIZA chatbot with Language-Model-of-Certain-Size
  manners (and the occasional real answer).
* [`simxplorer/`](simxplorer/) – Simxplorer, a 1996-style web browser
  program with a JavaScript interpreter written in SPARK (XMLHttpRequest
  included), and `SNIFF.SPK` for "best viewed in Simxplorer" server pages.
* [`simpal/`](simpal/) – SimPal, a late-90s PayPal: send and request
  SimBucks, and a Pay with SimPal button for any web site, on a crash-proof
  ledger.
* [`simtube/`](simtube/) – SimTube, a movie site for SimMovies (canvas
  drawing, one line a frame).
* [`simplayer/`](simplayer/) – SimPlayer, the streaming movie player: a
  Vapor app of its own, and built into Simxplorer.
* [`simhost/`](simhost/) – SimHost: every web app on one machine, each in a
  folder of its own, and Move In to bring the other machines' data over.
* [`simstats/`](simstats/) – SimStats, Hitbox-style web statistics for any
  site on the network: a tracking tag, unique visitors, top pages, referrers,
  browsers, live hits and LED hit counters.
* [`simnic/`](simnic/) – SimNIC, the network's one domain registrar (a 1996
  InterNIC) and its BIND-style name server, on the central host
  STARTHERE.56k.net: register `coolsite.sim` and point it at your machine.
* [`simweb/`](simweb/) – simweb, for every machine with a web site: a web
  server that serves many sites by name, Personal Web Manager to say which
  pages each name gets (`coolsite.sim`, `coolbook.sim` for SimBook...), `DIG`,
  and the resolver every program uses to look names up.
* [`vspark/`](vspark/) – Visual SPARK, a Visual BASIC-style IDE: draw a
  window with a toolbox and a form designer, set properties, double-click a
  control to write its event's code from a template, and run it with F5.
  Projects are ordinary .SPK files.
* [`welcome/`](welcome/) – the Welcome Wagon, a greeter bot for
  STARTHERE. It waits in `#general` on every machine's Chat, says hello to
  newcomers, and points them at STARTHERE's sites. It also links every
  machine's `#general` into one conversation, with people under their own
  names.
* [`simsh/`](simsh/) – Sim Shell, a bash-like terminal with pipes, variables,
  scripts, `ssh`/`scp` (rsh with a password, not secure) and `sim-get`.
* [`tools/aspsim/`](tools/aspsim/) – a headless SIM95 for testing SPARK
  programs and `.ASP` pages from Node, including several machines on a
  pretend network running real programs.
* `Sparks-language.txt` – the SPARK language reference.
* [`SIM95-NOTES.md`](SIM95-NOTES.md) – platform limits and a kernel bug worth
  knowing about.

**Your store, from GitHub:** with SIM95 open in your browser, paste this
into the browser's console (F12). It puts every app and game in this
repository on your machine's Vapor shelves, at the newest build, and makes
the machine a store if it wasn't one. Paste it again after the repository
changes; every Vapor shopping there then offers **Update**.

```js
fetch("https://raw.githubusercontent.com/dabbers/sim95/main/tools/vapor-bridge.js").then(r => r.text()).then(eval)
```

See [Vapor's README](vapor/README.md#stocking-the-shelves-from-github-the-bridge).

**A new machine:** paste the 21 lines from
[Vapor's quick start](vapor/README.md#quick-start-a-new-machine-in-one-paste)
into SPARK and press F5. They fetch Vapor from STARTHERE, and Vapor installs
the rest.

Paste an app's `INSTALL.SPK` into SPARK and press F5. On its own, a web app
becomes its machine's home page: one machine per app. Install
[SimHost](simhost/) first and they all share one machine instead, at
`/book/`, `/mail/`, `/ask/`, `/geo/`, `/wiki/`, `/eliza/`, `/pal/`, `/tube/` and `/stats/`; that is one browser tab for the
lot. Simxplorer installs as a program (`C:\PROGRAMS\SIMXPLOR.SPK`) on any
machine.

Domain names: SimNIC runs on STARTHERE.56k.net, and every program on every
machine asks it about names like `coolsite.sim` (no setting needed). To put
a site at a name, register it and point it at your machine at
`http://starthere.56k.net/nic/`, then add it in Personal Web Manager
([simweb](simweb/), on every Vapor store's shelves). The central host is one
line in `tools/simxplorer-source.mjs` (`CENTRAL`).

Tests: `node tools/aspsim/<app>.test.mjs` (simbook, coldmail, asksim, eliza,
jscript, simxplorer,
frostbird, clippy, vapor, simhost, geosimies, simpal, simtube, simstats, simsh,
wikisim, simnic, simweb, dnsapps, voyagerdns, bridge, welcome, vspark). `SIM95_HTTPD=simweb/src/HTTPD.SPK node tools/aspsim/<app>.test.mjs`
runs a suite with simweb's web server in place of the stock one. Rebuild the installers with `node tools/build-installer.mjs`.
