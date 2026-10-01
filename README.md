# sim95
A series of programs for the sim95 playground

* [`simbook/`](simbook/) – SimBook, a tiny early-Facebook-style social network
  written in SPARK ActiveSparkPages.
* [`coldmail/`](coldmail/) – ColdMail, a mail server and webmail that send
  real mail between SIM95 machines.
* [`asksim/`](asksim/) – AskSim, an Ask Jeeves-style search engine with a
  real crawler that goes round every machine's web pages.
* [`eliza/`](eliza/) – ELIZA-95, an ELIZA chatbot with large-language-model
  manners (and the occasional real answer).
* [`explorer/`](explorer/) – Internet Explorer 3 for SIM95: a browser
  program with a JavaScript interpreter written in SPARK.
* [`tools/aspsim/`](tools/aspsim/) – a headless SIM95 for testing SPARK
  programs and `.ASP` pages from Node, including several machines on a
  pretend network running real programs.
* `Sparks-language.txt` – the SPARK language reference.
* [`SIM95-NOTES.md`](SIM95-NOTES.md) – platform limits and a kernel bug worth
  knowing about.

Each web app installs as its machine's home page: one machine per app. Paste
the app's `INSTALL.SPK` into SPARK and press F5. Internet Explorer installs as
a program (`C:\PROGRAMS\IEXPLORE.SPK`) on any machine.

Tests: `node tools/aspsim/<app>.test.mjs` (simbook, coldmail, asksim, eliza,
jscript, explorer). Rebuild the installers with `node tools/build-installer.mjs`.
