# Simxplorer

A 1996-style web browser for SIM95, with JavaScript. It has a toolbar of
drawn buttons (arrows for Back and Forward, a stop sign, a house, a star), a
blue "S" whose gold swoosh spins while a page loads, `alert()` boxes, a
*Script Error* dialog and keyboard shortcuts. Pages are drawn by SIM95's own
`GUI_HtmlView`. The JavaScript runs in an interpreter written in SPARK.

## Installing

Paste `INSTALL.SPK` into SPARK, save it as `C:\MYFILES\INSTALL.SPK`, and
press F5. It writes `C:\PROGRAMS\SIMXPLOR.SPK` and starts it. Next time,
double-click `SIMXPLOR.SPK` in Files. Any machine can have it, and it does not
touch the web root.

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
`SIM95-NOTES.md`.

Tests:

* `node tools/aspsim/jscript.test.mjs` tests the engine on its own, using
  `test/HOSTSTUB.SPK`.
* `node tools/aspsim/simxplorer.test.mjs` tests the whole browser against
  real web servers on a pretend network, including SimBook and ELIZA-95.
