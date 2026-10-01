# Notes on the SIM95 platform

Things learned while building these apps, from reading the SIM95 bundle and
running its real kernel in `tools/aspsim`.

## Bug: a caught failed wait spoils the rest of the handler

**What happens:** some waits fail: `NET_Socket.Connect` when nobody answers,
and `NET_Connection.Receive` when the connection closes or times out. That
failure can be caught with `TRY`. But afterwards the same error is raised
again the next time that handler waits (for example `SYS.Sleep`). It is also
raised at the next pause the interpreter takes on its own, every 512
statements. Then it is no longer inside the `TRY`, so the program stops with a
runtime error.

```
SUB Main ()
    VAR s AS NET_Socket
    VAR conn AS NET_Connection
    s = NET_Socket.New()
    TRY
        conn = s.Connect("alpha", 80)     ' nothing listening
    CATCH err
        Print("caught: " + err)           ' prints, as it should
    END TRY
    SYS.Sleep(10)                         ' Runtime error: Connection refused
    Print("never printed")
END SUB
```

**Why:** in the kernel's task runner, a rejected wait is delivered by
replacing the task's generator:

```js
const u = s.gen;
s.gen = { next: () => u.throw(c), throw: d => u.throw(d), return: d => u.return(d), ... };
```

It is never put back, so every later `next()` throws `c` again.

**Fix (one line):** restore the generator on the way through:

```js
s.gen = { next: () => { s.gen = u; return u.throw(c); }, throw: d => { s.gen = u; return u.throw(d); }, ... };
```

**Until then:** a handler that can hit a failed wait should do that one thing
last. Wrap its whole body in `TRY … CATCH err` with an **empty** `CATCH` and
nothing after `END TRY`. Drive long jobs from a `GUI_Timer` so each step is a
fresh handler. Read pages with `onMessage`/`onClose` rather than `Receive`.
`asksim/PROGRAMS/CRAWLER.SPK` and `coldmail/PROGRAMS/MAILD.SPK` both do this.

## Limits worth knowing

* **64K per network message.** Voyager sends a whole request as one message,
  and `HTTPD.SPK` sends a whole page or file as one. A bigger request fails in
  Voyager with "Message too long". A bigger page stops the web server with a
  runtime error. Sketch saves 400x300 pictures (about 120K), so they can't be
  uploaded as they are.
* **8.3 file names** (`ABCDEFGH.EXT`), and `MakeDir` fails if the folder
  already exists.
* **Server pages** stop after 20,000 interpreter pauses, one every 512
  statements: roughly ten million statements. They can't open sockets.
* **Page scripts** (SPARK in Voyager) get only `PAGE`, `TIME`, `MATH`, and a
  `SYS` with `Ticks`, `Sleep` and `Beep`. `SYS.Sleep` doesn't count toward
  their time limit. A `<textarea>`'s `onchange` fires on every keystroke.
* **Names are not case-sensitive**, so a function `Letter` and a variable
  `letter` clash, as do a constant `STOP` and a local `stop`. `NEXT` is a
  reserved word.
* **Anything in `C:\SYSTEM\STARTUP\*.RUN`** (a file holding a program's path)
  starts when the machine does.
* **`HTTPD.SPK` serves `INDEX.ASP`** for a folder that has no `INDEX.HTM`.
* **`GUI_HtmlView` and forms:**
  * A form's data never includes the submit button that was pressed.
  * A submit button with an `onclick` doesn't send its form.
  * Enter in a text box sends the form, unless the box has an `onenter`.
  * A text box's `onchange` fires at every key, not when you leave the box.
  * The `action` is resolved against `Base`, unless it already has a scheme
    such as `sxsubmit:`, which Simxplorer relies on.
* **Voyager runs only SPARK scripts.** It ignores
  `<script language="JavaScript">` and `type="text/javascript"`, but treats a
  bare `<script>` as SPARK. So one page can carry SPARK for Voyager and
  JavaScript for Simxplorer.
* **Handlers interleave.** While one handler waits (`SYS.Sleep`, a message
  box), others run, including another tick of the same timer. Guard shared
  state with a flag.
* **One name per machine.** Each browser tab is one connection to SIM95's
  central server. The kernel registers the machine's single name with it (a
  `name` packet: `hello` on connect, `rename` when the name changes, which
  replaces the old one) and asks it to resolve names (`query`). SPARK programs
  can't send those packets, so a machine can't take extra names or aliases.
  Names can have an ISP part (`BOB.DIALUP.ZONE`), and a lookup of just `BOB`
  finds it. To run several web apps on one machine, give each a folder (see
  `simhost/`).
* **Two lookups of one name at once lose the first.** The network stack
  keeps one waiter per name, so when a program (or two programs on one
  machine) look up `BRAVO` while a lookup of `BRAVO` is still out, the first
  never comes back: its `NET.Resolve`, or its `Connect("bravo", 80)`, waits
  forever, without even timing out. Look names up one at a time
  (`NET.Resolve`, then `Connect` to the address), and keep what you find.
  Simxplorer, which fetches several things at once, does.
* **A close can overtake the last message.** Each machine's stack delays
  what arrives by a little and hands it on with a timer. When answers on
  several connections arrive in the same instant, the `close` of one can be
  handed on before its last message, and that message is then dropped: the
  connection just closes, empty. Seen in `tools/aspsim` with a server
  answering three requests in one millisecond. A client that opens several
  connections should space them out (Simxplorer starts at most one every
  50 ms).
* **The Files service** (`C:\PROGRAMS\FILESVC.SPK`, port 139, on by
  default) lets anyone with the machine's user name and password from
  `C:\SYSTEM\USERS.INI` read and write all of C:. Commands: `AUTH user|password`,
  then `LIST`, `READ`, `WRITE path` plus a newline and the text, `DEL`,
  `MKDIR`, `REN from|to`, `STAT`. Replies start with OK or ERR, one message
  each, so a file over 64K can't be read through it.
* **`FS.Rename` moves** files and whole folders, across folders too.
* **ASP pages in subfolders work:** `<%@ import file="X.SPK" %>` is relative
  to the page, and `SERVER.ScriptName` is the page's disk path
  (`C:\WEB\BOOK\HOME.ASP`), so a page can find its own folder from it.

## The web server, names and addresses (found for SimDNS)

* **`HTTPD.SPK` is only written when a disk is made.** The stock web server
  is part of the fresh disk image, which SIM95 writes on a machine's first
  boot (no saved disk yet). A normal boot loads the saved disk as it is and
  writes nothing back, so a changed `C:\PROGRAMS\HTTPD.SPK` stays. The one
  other time it comes back is **Reinstall** on the start-up error screen
  (shown only when `C:\SYSTEM\CORE.SYS` is missing), which rebuilds the whole
  disk from the image and keeps only `C:\MYFILES` and `USERS.INI`; that wipes
  `C:\WEB` and every app anyway.
* **How the web server starts.** At boot, everything in `C:\SYSTEM\STARTUP`
  runs (`WEB.RUN` holds `C:\PROGRAMS\HTTPD.SPK`), then the services list:
  `web`, `files` and `chat` (`HTTPD.SPK`, `FILESVC.SPK`, `CHATSVC.SPK`), each
  started if it is switched on in `C:\SYSTEM\SETTINGS.INI` (`services.web`,
  on unless it says 0/false/off) and not already running. "Running" means a
  process whose path is that file. The list is checked again whenever
  `SETTINGS.INI` changes, and a service switched off has its processes
  killed. `C:\SYSTEM\HTTPD.EXE` is a built-in that just starts the same file.
  So the way to replace the web server is to write a new
  `C:\PROGRAMS\HTTPD.SPK`, then kill the task named `HTTPD` and `SYS.Run` the
  file (only if one was running: if it is off in Settings, leave it off).
* **`Connect` takes an address as well as a name.** A dotted quad
  (`65.16.0.3`) is used as it is, without asking the network server, and
  `NET.Resolve("65.16.0.3")` returns it unchanged. `localhost`, `127.0.0.1`,
  the machine's own name and the first part of it are its own address, also
  without asking. Connecting to an address sidesteps the "two lookups of one
  name" problem above.
* **SPARK has no file times.** `FS` has `Size`, but nothing says when a file
  changed. A program that wants to notice changes (NAMED.SPK reloading its
  zones) keeps the text and compares.
* **`ASP.Render` reads everything from the request text it is given:** the
  request line becomes `REQUEST.Path` and `QueryString`, and the headers
  `REQUEST.Host` and `REQUEST.Header`. So a web server can change the request
  before handing it over, which is how SimDNS's `HTTPD.SPK` shows a page at
  `/www.coolsite.sim/page.asp` the path `/page.asp`.
* **`<%= ... %>` writes text as it is**, not HTML-encoded: use
  `SERVER.HtmlEncode` for anything a visitor typed.
