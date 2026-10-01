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
* [`simdns/`](simdns/) – SimDNS, domain names for SIM95: a BIND-style name
  server, SimNIC (a 1996 InterNIC registrar), `DIG`, a resolver Simxplorer
  uses, and a web server that hosts many sites on one machine.
* [`simsh/`](simsh/) – Sim Shell, a bash-like terminal with pipes, variables,
  scripts, `ssh`/`scp` (rsh with a password, not secure) and `sim-get`.
* [`tools/aspsim/`](tools/aspsim/) – a headless SIM95 for testing SPARK
  programs and `.ASP` pages from Node, including several machines on a
  pretend network running real programs.
* `Sparks-language.txt` – the SPARK language reference.
* [`SIM95-NOTES.md`](SIM95-NOTES.md) – platform limits and a kernel bug worth
  knowing about.

Paste an app's `INSTALL.SPK` into SPARK and press F5. On its own, a web app
becomes its machine's home page: one machine per app. Install
[SimHost](simhost/) first and they all share one machine instead, at
`/book/`, `/mail/`, `/ask/`, `/geo/`, `/wiki/`, `/eliza/`, `/pal/`, `/tube/`, `/stats/` and `/dns/`; that is one browser tab for the
lot. Simxplorer installs as a program (`C:\PROGRAMS\SIMXPLOR.SPK`) on any
machine.

Tests: `node tools/aspsim/<app>.test.mjs` (simbook, coldmail, asksim, eliza,
jscript, simxplorer,
frostbird, clippy, vapor, simhost, geosimies, simpal, simtube, simstats, simsh,
wikisim, simdns). `SIM95_HTTPD=simdns/src/HTTPD.SPK node tools/aspsim/<app>.test.mjs`
runs a suite with SimDNS's web server in place of the stock one. Rebuild the installers with `node tools/build-installer.mjs`.
