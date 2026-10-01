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
* [`eliza/`](eliza/) – ELIZA-95, an ELIZA chatbot with Language-Model-of-Certain-Size
  manners (and the occasional real answer).
* [`simxplorer/`](simxplorer/) – Simxplorer, a 1996-style web browser
  program with a JavaScript interpreter written in SPARK.
* [`simhost/`](simhost/) – SimHost: every web app on one machine, each in a
  folder of its own, and Move In to bring the other machines' data over.
* [`tools/aspsim/`](tools/aspsim/) – a headless SIM95 for testing SPARK
  programs and `.ASP` pages from Node, including several machines on a
  pretend network running real programs.
* `Sparks-language.txt` – the SPARK language reference.
* [`SIM95-NOTES.md`](SIM95-NOTES.md) – platform limits and a kernel bug worth
  knowing about.

Paste an app's `INSTALL.SPK` into SPARK and press F5. On its own, a web app
becomes its machine's home page: one machine per app. Install
[SimHost](simhost/) first and they all share one machine instead, at
`/book/`, `/mail/`, `/ask/`, `/geo/` and `/eliza/`; that is one browser tab for the
lot. Simxplorer installs as a program (`C:\PROGRAMS\SIMXPLOR.SPK`) on any
machine.

Tests: `node tools/aspsim/<app>.test.mjs` (simbook, coldmail, asksim, eliza,
jscript, simxplorer,
frostbird, clippy, vapor, simhost, geosimies). Rebuild the installers with `node tools/build-installer.mjs`.
