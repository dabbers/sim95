# Internet Explorer for SIM95

A web browser for SIM95 that behaves like Internet Explorer 3: the toolbar,
the spinning "e", `alert()` boxes with the yellow triangle, the *Internet
Explorer Script Error* dialog, and JavaScript. Pages are drawn by SIM95's
own `GUI_HtmlView`. The JavaScript runs in an interpreter written in SPARK.

## Installing

Paste `INSTALL.SPK` into SPARK, save it as `C:\MYFILES\INSTALL.SPK`, and
press F5. It writes `C:\PROGRAMS\IEXPLORE.SPK` and starts it. Next time,
double-click `IEXPLORE.SPK` in Files. Any machine can have it, and it does not
touch the web root.

## What it does

* **Browsing like Voyager:** HTTP/1.0 GET and POST, redirects, file uploads,
  `SIM95PIC` pictures, and `file:` addresses. It shares Voyager's cookie jar
  (`C:\SYSTEM\COOKIES.TXT`). The first time it runs, your Voyager bookmarks
  become your Favorites.
* **Toolbar:** Back, Forward, Stop, Refresh, Home, Search, Favorites, History
  and Mail. The Address bar has a Go button. Click the "e" to go home.
* **Menus:**
  * File: New Window, Open, Save As File, Close.
  * View: Stop, Refresh, Source (opens in Notes), Options.
  * Go, Favorites (with Add To Favorites, Ctrl+D) and Help.
* **AutoSearch:** type words in the Address bar, or `? chess`, `go chess` or
  `find chess`, and it searches with the search engine set in Options. The
  first time it runs, it uses this machine's AskSim if it has one.
* **When a site is down:** you get IE's *cannot open the Internet site* box.
  If a search engine is set, it also offers AskSim's cached copy of the page
  (`cache.asp?url=...`).
* **Built-in pages:** `about:history`, `about:favorites`, `about:options` and
  `about:search`.

## JavaScript (JScript, `src/JSCRIPT.SPK`)

The JavaScript of 1996, with a few later conveniences.

* **Language:**
  * `var`, functions, closures, `this`, `new` and prototypes.
  * `if`, `while`, `do`, `for`, `for-in`, `switch`, `try`/`catch`/`finally`
    and labels-free `break`/`continue`.
  * `typeof`, `in`, `instanceof` and `eval`.
* **Built-in objects:** `Math`, `Date` (with IE's `getYear()` quirk),
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
    (it says MSIE 3.02), and `window.status`.
  * `alert`, `confirm`, `prompt` (in its own *Explorer User Prompt*
    window), `setTimeout`, `setInterval` and `window.open`.
* **Events:**
  * `onclick` (on links, it can return `false`), `onchange`, `onenter`,
    `<body onload>`, `<form onsubmit>` (`return check(this)`), and
    `javascript:` links.
  * `<meta http-equiv="refresh">` and `<noscript>` are handled too.
* **Errors:**
  * They read as IE's did, for example `'x' is undefined`,
    `'o' is null or not an object` and `Object doesn't support this property
    or method`.
  * The error dialog gives the document's line number. Answer No and the
    page's scripts stop.
  * A runaway loop brings up *A script on this page is causing Internet
    Explorer to run slowly*.

It has no regular expressions, bitwise operators or `<script src>`.

## SPARK pages and Voyager

Voyager runs `<script type="spark">` and ignores
`<script language="JavaScript">`. IE does the opposite, so one page can carry
both. On a page with SPARK scripts, IE leaves the SPARK event handlers alone
and says so in the status bar. SimBook and ELIZA-95 work in IE, minus their
SPARK flourishes.

## How it's put together

`src/BROWSER.SPK` is the window. `src/JSCRIPT.SPK` is the engine, which reaches
the page only through `Host...` functions that the window defines.
`tools/build-installer.mjs` joins the two into `IEXPLORE.SPK`.

Before a page is drawn:

1. Its `<script>` blocks are taken out.
2. Every form field is given an id.
3. Every `onclick` becomes `js:N`, and every form's action becomes
   `iesubmit:N`, so clicks and submissions come back to the browser first.
4. The scripts run, and what they write goes where they were.

Fetches start from a timer tick, because of the kernel bug described in
`SIM95-NOTES.md`.

Tests:

* `node tools/aspsim/jscript.test.mjs` tests the engine on its own, using
  `test/HOSTSTUB.SPK`.
* `node tools/aspsim/explorer.test.mjs` tests the whole browser against real
  web servers on a pretend network, including SimBook and ELIZA-95.
