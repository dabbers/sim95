# Simxplorer

A 1996-style web browser for SIM95, with JavaScript. It has a toolbar of
drawn buttons (arrows for Back and Forward, a stop sign, a house, a star), a
blue "S" whose gold swoosh spins while a page loads, `alert()` boxes, a
*Script Error* dialog and keyboard shortcuts. Pages are drawn by SIM95's own
`GUI_HtmlView`. The JavaScript runs in an interpreter written in SPARK.

## Installing

Paste `INSTALL.SPK` into SPARK, save it as `C:\MYFILES\INSTALL.SPK`, and
press F5. It writes `C:\PROGRAMS\SIMXPLOR.SPK` and starts it. Next time,
double-click `SIMXPLOR.SPK` in Files. Any machine can have it. It leaves the
home page alone, but puts its demo, the Live Page, in `C:\WEB\SXDEMO`
(`http://YOURNAME/sxdemo/` while the web server runs), with `SNIFF.SPK` for
other web apps to use (see *Best viewed in Simxplorer* below).

## What it does

* **Browsing like Voyager:** HTTP/1.0 GET and POST, redirects, file uploads,
  `SIM95PIC` pictures, and `file:` addresses. It shares Voyager's cookie jar
  (`C:\SYSTEM\COOKIES.TXT`). The first time it runs, your Voyager bookmarks
  become your Favorites.
* **Toolbar:** Back, Forward, Stop, Refresh, Home, Search, Favorites, History
  and Mail, greyed out when they can't be used. The Address bar has a Go
  button. Click the "S" to go home.
* **Menus:**
  * File: New Window, Open, Save As File, Close.
  * Edit: Cut, Copy, Paste, Select All, Find (on This Page), Find Next.
  * View: Stop, Refresh, Source (opens in Notes), Options.
  * Go: Back, Forward, Address Bar, Start Page, Search the Web, Read Mail,
    History.
  * Favorites (Add, Organize, Show) and Help.
* **Find (on This Page)**, with Ctrl+F then F3: the match is marked in red
  and the page scrolls to roughly where it is. It says *Finished searching
  the page* at the end. Whatever you typed into the page is kept.
* **AutoSearch:** type words in the Address bar, or `? chess`, `go chess` or
  `find chess`. Ctrl+E opens a *Search the Web* box. Both use the search
  engine set in Options. The first time it runs, it picks this machine's
  AskSim if it has one.
* **When a site is down:** it says it *cannot open the Internet site*. If a
  search engine is set, it offers AskSim's cached copy of the page
  (`cache.asp?url=...`).
* **Built-in pages:** `about:history`, `about:favorites`, `about:options`,
  `about:search` and `about:keys` (Help > Keyboard Shortcuts, F1).

### Keyboard shortcuts

| Keys | | Keys | |
|---|---|---|---|
| Alt+Left / Alt+Right | Back / Forward | Ctrl+F, F3 | Find, Find Next |
| Esc | Stop | Ctrl+D | Add to Favorites |
| F5 | Refresh | Ctrl+I / Ctrl+B | Show / Organize Favorites |
| Alt+Home | Start page | Ctrl+H | History |
| Alt+D, Ctrl+O | Address bar | Ctrl+M | Mail |
| Ctrl+E | Search the Web | Ctrl+U | View Source |
| Ctrl+N | New window | Ctrl+S | Save the page |
| Ctrl+W | Close | F1 | List of shortcuts |

SIM95 sends Ctrl, Alt and F-key combinations to the menu items that list them.

### Copy and paste

SPARK programs can't reach the real clipboard. So:

* **In a text box** (the Address bar or a field on the page), Ctrl+X, Ctrl+C,
  Ctrl+V and Ctrl+A go straight to the box. Ctrl+C on text selected in the
  page also works as usual.
* **The Edit menu** uses SIM95's own clipboard, the file
  `C:\SYSTEM\CLIPBRD.TXT`:
  * Copy takes the Address bar, or the whole page's text after Select All.
    Otherwise it takes the page's address.
  * Paste puts the clipboard into the Address bar.

## JavaScript (`src/JSCRIPT.SPK`)

The JavaScript of 1996, with a few later conveniences.

* **Language:**
  * `var`, functions, closures, `this`, `new` and prototypes.
  * `if`, `while`, `do`, `for`, `for-in`, `switch`, `try`/`catch`/`finally`,
    `break` and `continue`.
  * `typeof`, `in`, `instanceof` and `eval`.
* **Built-in objects:** `Math`, `Date` (with the old `getYear()` quirk),
  `String`, `Array`, `Number`, `parseInt`, `escape` and `unescape`.
  * Strings have the HTML helpers too: `"hi".bold()` gives `<B>hi</B>`.
  * Numbers print exactly as JavaScript prints them: `0.1 + 0.2` gives
    `0.30000000000000004`.
* **The page:**
  * `document.write` while the page loads, and after it loads, which
    replaces the page, as it did then.
  * `document.forms`, `form.field.value`, `getElementById`, `innerText`,
    `.value`, `.checked`, `.disabled`, and `style.display`/`visibility`.
  * `document.title`, `document.cookie`, `location`, `history`, `navigator`
    (`appName` is "Simxplorer"), and `window.status`.
  * `alert`, `confirm`, `prompt`, `setTimeout`, `setInterval` and
    `window.open`.
  * `document.all`, as IE has it: `document.all.clock`,
    `document.all["clock"]`, `document.all.item("clock")`.
* **Events:**
  * `onclick` (on links, it can return `false`), `onchange`, `onenter`,
    `<body onload>`, `<form onsubmit>` (`return check(this)`), and
    `javascript:` links.
  * On a text box, `onchange` fires once typing pauses, rather than at every
    key as the view reports it.
  * `<meta http-equiv="refresh">` and `<noscript>` are handled too.
* **Errors:**
  * They read the way 1996 browsers put them, for example
    `'x' is undefined` and `'o' is null or not an object`.
  * The error dialog gives the document's line number. Answer No and the
    page's scripts stop.
  * A runaway loop brings up *A script on this page is causing Simxplorer to
    run slowly*.

It has no regular expressions, bitwise operators or `<script src>`.

### Talking to the server: XMLHttpRequest

Pages can fetch from their server in the background and change themselves
without a reload, the way IE 5 brought in. Both names work:

```js
var x = window.XMLHttpRequest ? new XMLHttpRequest()
                              : new ActiveXObject("Microsoft.XMLHTTP");
x.onreadystatechange = function () {
  if (x.readyState == 4 && x.status == 200)
    document.getElementById("clock").innerText = x.responseText;
};
x.open("GET", "time.asp", true);
x.send(null);
```

* `open(method, url, async)`, `setRequestHeader`, `send(body)`, `abort`,
  `getResponseHeader`, `getAllResponseHeaders`; `readyState`, `status`,
  `statusText`, `responseText`; `onreadystatechange`, `onload`, `onerror`.
* `ActiveXObject` makes `"Microsoft.XMLHTTP"` and `"Msxml2.XMLHTTP"`. Any
  other name fails as IE's did: *Automation server can't create object*.
* Addresses are relative to the page. A request carries the browser's
  User-Agent and this machine's cookies for that server, and a
  `Set-Cookie` in the answer goes in the jar. A POST with no
  `Content-Type` is sent as a form (`application/x-www-form-urlencoded`).
* `onreadystatechange` hears 1 at `open`, then 2 and 3 as the answer starts
  to arrive, and 4 when it is all in. `this` is the request.
* A request that cannot be made (an unknown machine, nobody listening, no
  answer within six seconds) ends at readyState 4 with status 0, and
  `onerror` runs.
* Several can be on their way at once, each on a connection of its own.
  One starts per tick of the browser's clock (50 ms), like everything else
  that waits on the network.
* **Asynchronous only.** `open(method, url, false)` stops the script with
  *Simxplorer cannot wait for the network in the middle of a script*: the
  browser only fetches between scripts.
* A request still on its way when the page goes is forgotten.
* `file:` pages can read files next to them the same way.

`fetch(url[, {method, body, headers}])` is there too, with a small promise:
`then`, `catch`, chaining, and a callback that returns a promise is waited
for. The response has `status`, `ok`, `statusText`, `url`, `headers.get()`,
`text()` and `json()`. A request that fails rejects; a 404 does not. Arrow
functions work, so `fetch("news.txt").then(r => r.text()).then(t => ...)`
does what it says. There is no global `Promise` to make your own.

### Best viewed in Simxplorer

`navigator.appName` is "Simxplorer", `appCodeName` "Mozilla", `appVersion`
"2.0 (compatible; Simxplorer 3.02; SIM95)", `userAgent` "Mozilla/2.0
(compatible; Simxplorer 3.02; SIM95)" and `platform` "SIM95". Voyager sends
`Voyager/1.1 (SIM95)`.

On the server, `C:\WEB\SXDEMO\SNIFF.SPK` (from `WEB/SNIFF.SPK` here) reads
`REQUEST.Header("User-Agent")` for any ActiveSparkPage that imports it:

```
<%@ import file="../SXDEMO/SNIFF.SPK" %>      (or "C:\WEB\SXDEMO\SNIFF.SPK",
                                                or a copy next to your page)
<% VAR gate AS String
   gate = NeedsSimxplorer("3.0")
   IF gate <> "" THEN
       RESPONSE.Write("<html><body>" + gate + "</body></html>")
       RESPONSE.End()
   END IF %>
```

| Function | Gives |
|---|---|
| `IsSimxplorer()`, `IsVoyager()` | `TRUE` for that browser |
| `BrowserName()` | "Simxplorer", "Voyager", the first word of anything else, or "Unknown" |
| `BrowserVersion()` | "3.02", "1.1", or "" |
| `NeedsSimxplorer(minVersion)` | "" in Simxplorer that new; elsewhere a blue *This page requires Simxplorer 3.0 or higher - Download it now!* box. The link goes to this machine's Vapor store if it stocks Simxplorer, or else to `/sxdemo/getsx.htm` |

Its own helpers start with `Sniff`, so they stay out of the page's way.

The Live Page (`WEB/INDEX.ASP`) is the demo: a clock and a count of answered
requests that keep up with the server through `TIME.ASP` once a second,
a box that POSTs to the server and shows the answer, and the 88x31 *Best
viewed in Simxplorer* badge (`BADGE.PIC`). Voyager gets the *requires
Simxplorer* box instead.

## SPARK pages and Voyager

Voyager runs `<script type="spark">` and ignores
`<script language="JavaScript">`. Simxplorer does the opposite, so one page can
carry both. On a page with SPARK scripts, Simxplorer leaves the SPARK event
handlers alone and says so in the status bar. SimBook and ELIZA-95 work in
Simxplorer. ELIZA-95's answers type themselves out in either browser.

## How it's put together

`src/BROWSER.SPK` is the window. `src/JSCRIPT.SPK` is the engine, which reaches
the page only through `Host...` functions that the window defines.
`tools/build-installer.mjs` joins the two into `SIMXPLOR.SPK`.

Before a page is drawn:

1. Its `<script>` blocks are taken out.
2. Every form field is given an id.
3. Every `onclick` becomes `js:N`, and every form's action becomes
   `sxsubmit:N`, so clicks and submissions come back to the browser first.
4. The scripts run, and what they write goes where they were.

Fetches start from a timer tick, because of the kernel bug described in
`SIM95-NOTES.md`, one Connect a tick: the page first, then the scripts'
requests, then pictures. Host names are looked up one at a time and kept
for 30 seconds, because two lookups of one name at once lose the first
(also in `SIM95-NOTES.md`).

Tests:

* `node tools/aspsim/jscript.test.mjs` tests the engine on its own, using
  `test/HOSTSTUB.SPK`.
* `node tools/aspsim/simxplorer.test.mjs` tests the whole browser against
  real web servers on a pretend network, including SimBook and ELIZA-95.

## Movies

SimPlayer is built in. A SimMovie link (SimTube's `movie.asp?v=N`, served as
`video/x-simmovie`, or any file starting `SIMMOVIE`) pops up a SimPlayer
window of the browser's own, with every control the standalone player has,
and the browser stays on the page it was on. Another movie reuses the window,
and closing it leaves the browser running. No download needed.

It is the same code as SimPlayer on its own (`simplayer/src/PLAYER.SPK`).
`tools/simxplorer-source.mjs` adds it to `SIMXPLOR.SPK` with every top-level
name prefixed `Mv`, because a SPARK program has one namespace and the
player's names (`win`, `state`, `StartFetch`...) are the browser's names too.
