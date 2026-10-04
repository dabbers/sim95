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
* **Voyager asks for a page's pictures all at once,** each by the name in its
  URL. So on a page served by name (`http://starthere/wall/`), only one
  picture arrived; the other lookups never came back, and those pictures
  show as broken. A page with several pictures gives them by the server's
  address instead (`"http://" + NET.LocalAddress + ...`, which an ASP page
  can read), as the Pixel Wall does now. Simxplorer fetches one at a time,
  so it never showed.
* **SPARK has no file times.** `FS` has `Size`, but nothing says when a file
  changed. A program that wants to notice changes (NAMED.SPK reloading its
  zones) keeps the text and compares.
* **`ASP.Render` reads everything from the request text it is given:** the
  request line becomes `REQUEST.Path` and `QueryString`, and the headers
  `REQUEST.Host` and `REQUEST.Header`. So a web server can change the request
  before handing it over, which is how simweb's `HTTPD.SPK` shows a page at
  `/www.coolsite.sim/page.asp` the path `/page.asp`.
* **`<%= ... %>` writes text as it is**, not HTML-encoded: use
  `SERVER.HtmlEncode` for anything a visitor typed.

## SPARK details (found for simweb)

* **`onDraw`'s handler takes a `GUI_Canvas`.** The reference writes
  `onDraw(canvas AS Any)`, but `Any` is not a type a program can write:
  `SUB Side_OnDraw (canvas AS Any)` stops the compile with *Unknown type
  'Any'*. `SUB Side_OnDraw (canvas AS GUI_Canvas)` works.
* **`Handler` is a type for parameters too.** `FUNCTION SideButton (text AS
  String, y AS Integer, h AS Handler) AS GUI_Button` can set
  `b.onClick = h`, and is called with a SUB's name. And `x = NOTHING` empties
  an object variable, so `IsNothing(x)` is TRUE again (a closed dialog).
* **A timer tick can come between a key and its handler.** Enter in a text
  box queues `onEnter`; a tick that runs first and sets the box's `Text`
  (to clear it, say) leaves the handler reading what the tick wrote. Don't
  reset an input box from a tick that repeats; do it once, and remember that
  it was done. (The Sim Shell's password prompt did this, now and then.)

## The Chat service (found for the Welcome Wagon)

* **Lines sent together can arrive shuffled.**
  * **The cause:** `CHATSVC.SPK` handles each line it gets as a task of its
    own. A task is paused every 512 statements, and the service's name check
    (`Clean`) walks a line character by character. So a long line's task can
    be paused while a shorter line sent just after it finishes first.
  * **What it does:**
    * Four `MSG`s sent in a row reach the room in another order.
    * A `JOIN` sent right after `NICK` can be broadcast with the old
      `guestNNN` name; the Chat program sends exactly that pair on Connect.
    * A `QUIT` sent after a `MSG` can close the connection before the
      message goes out.
  * **What a bot can do:**
    * Send `JOIN` only after the `OK You are now ...` reply to `NICK`.
    * Space its lines out (the Welcome Wagon sends one every half second).
    * Wait a moment before greeting somebody who joined, and follow any
      `NICK #chan old new` that comes in the meantime.
  * **A fix in the service** would be to handle a connection's lines one at
    a time, in order: keep a queue per connection, and work through it from
    one task. [`chatfix/`](chatfix/) does this (one queue for all, which
    keeps each connection's order).
  * **Later:** with the SIM95 of October 2026, the shuffle didn't happen again
    in `tools/aspsim`, not even with bursts of 30 lines of mixed length, to
    the stock service or the fixed one.
* **Bug: Disconnect in Chat often crashes the Chat service, with an error
  box.**
  * **Symptom:** the newcomer presses Disconnect and gets
    *Runtime error in Sock_OnMessage (line 157): Connection closed* from
    `CHATSVC.SPK`. The machine's Chat service is gone until it restarts, and
    the next Connect is refused.
  * **How often:** with nothing else on the machine, it happens within one to
    six Connect/Disconnect presses.
  * **Cause:** the Chat program's `Disconnect` sends `QUIT` and closes the
    socket at once. The service's `QUIT` case runs `LeaveAll`, then
    `conn.Send("OK Bye")`. When the close has landed first, that `Send`
    throws, and nothing catches it.
  * **Fix, in the service:** put `conn.Send("OK Bye")` and `conn.Close()` in
    a `TRY` with an empty `CATCH`, or check `conn.IsOpen` first. (Or, in the
    program, wait for `OK Bye` before closing.) `Broadcast` already checks
    `IsOpen`; the replies to the sender don't.
  * **Any reply can do it,** not only `OK Bye`: "Nick in use" (line 112) was
    seen on STARTHERE. [`chatfix/`](chatfix/) sends every line through one
    SUB that lets a closed connection pass. A failed `Send` caught with `TRY`
    doesn't spoil the handler the way a failed `Connect` or `Receive` does.
* **There is no history.** A line goes only to whoever is in the channel at
  that moment. Somebody who joins later sees nothing that was said before.
* **The Chat program defaults to this machine's own service, in
  `#general`.** So a newcomer who opens Chat and presses Connect is alone,
  unless something else is already waiting in that room.
* **A machine that leaves says nothing.** When a machine drops off the
  network (its tab is closed), the other machines' connections to it don't
  close: they just go quiet. A program that waits to be told someone left
  will list them forever. This was seen on the live network as people still
  listed after their machine had gone. The Welcome Wagon notices instead:
  * a machine missing from two `NET.Machines()` looks in a row has gone;
  * a room that hasn't answered `WHO` for three looks round is presumed
    dead.

  The test network's `m.unplug()` does the same to a machine, so this can
  be tested.
* **`NET.Machines()` is a broadcast ping.** It waits about 0.7 s for the
  answers and returns them as `NAME ADDRESS MS`. Every machine sees the ping
  in Monitor, so calling it every half minute is fine, and calling it every
  second is noisy.

## Files: Copy and Paste between windows

Copy in one Files window and Paste in another does nothing, with no message.
Each Files window (`C:\PROGRAMS\FILES.SPK`) is a program of its own, with
what was copied in a variable (`clipboard`), so a second window has nothing to
paste. That's how files usually go to another machine: Network's Files button
opens a second window. Copying a folder also does nothing silently.
[`filefix/`](filefix/) changes Copy and Paste to keep the copied file in
`C:\SYSTEM\FILECLIP.TXT`. A fix in SIM95 itself could do the same, or keep a
clipboard in the system for every program.

## A failed Connect loses other connects that are waiting

When one `Connect` fails (refused, unknown host) while another `Connect` in
the same program is still waiting, the waiting one never returns: no
connection, and no error. It happens even when the two use different
`NET_Socket`s. Node for SIM95 (`node/src/NODEHOST.SPK`) makes its
connections one at a time, each on a socket of its own, and gives up on one
that hasn't come back after 15 seconds. (This sits alongside the older note
that a caught failed Connect spoils the rest of its handler.)

Two more things worth knowing, found while building Node:
* **Call depth:** a SPARK program can nest about 150 to 200 calls. The
  JavaScript engine uses about seven per JavaScript call, so it stops at 24
  (`JSMAXDEPTH`).
* **Long loops:** while a handler runs without waiting, no other handler of
  the program runs (timers wait). Handlers only interleave where something
  waits (`Connect`, `NET.Machines`, `ReadLine`...).

Found while building npm:
* **ASP pages can take a raw body.** `REQUEST.Body` is a POST's body exactly
  as sent, line breaks and all; `REQUEST.Form` decodes a form. npm publishes
  each 30K part of a package as a body, with the rest in the query string.
* **Everything after an ASP page's last `%>` is sent too**, its line break
  included. A page that answers a program, rather than a person, ends with
  `RESPONSE.End()`, so nothing stray follows.
* **`who` is a built-in name**, so it can't be a variable.
* **The JavaScript engine kept every property of every object in one list**,
  searched from the start each time, and every array method copied the whole
  array first. So a `push` cost as much as all the properties in the program,
  and building a 1,800-line array took 77 seconds. Now each object has an
  index of its own (a string of names and slots, searched with `IndexOf`),
  freed slots are used again, and `push` and `pop` touch only the end. The
  same array takes under 2 seconds, and pages in Simxplorer are faster too.

Found while building Explorer:
* **The desktop's icons are fixed.** My Computer runs `FILES.SPK C:\`, My
  Files runs `FILES.SPK C:\MYFILES`, and Start > Find > Files and a folder
  typed into Run use `FILES.SPK` too. `C:\SYSTEM\DESKTOP.INI` only keeps
  where the icons are. So a new file manager takes over by becoming
  `FILES.SPK`, as Explorer's launcher does.
* **A Canvas can draw before SIM95's font has loaded,** with a wider stand-in.
  Explorer paints once more after a moment.
* **`try` and `who` are reserved or built-in names**, and so are `len` and
  `icon`. Names clash without regard to case: `cX` (an array) and `cx` (a
  local) are one name.
* **The interpreter pauses every 512 statements** even in a handler that never
  waits. Nothing else of the program runs in those pauses, but a test (or the
  page) can look in between: a window's title can change before its status
  bar does.

Found while building the resident bridge:
* **A program that prints keeps running.** Started with `kernel.spawn(path,
  args)` from the page, a program that uses `Print` stays in `kernel.ps()`
  after its Main ends, since its output window stays open. Spawned with
  `kernel.spawn(path, args, { stdout: { text: "", destroyed: false,
  call(m, t) { if (m === "Write") this.text += t; } } })`, its output is
  collected there instead, and it ends when it's done. The resident bridge
  and the test network (`m.run`) both start programs this way.
* **Sim Shell over ssh runs no network jobs.** `sim-get`, `ssh` and `scp`
  over ssh say "needs the network; run it in the Sim Shell window". That's
  why `bridge update` only leaves a request, and the bridge runs
  `sim-get upgrade` in a window of its own (`SIMSH.SPK -c ... --exit`).
* **The page's machine object** (found by the bridges through React) has
  `fs`, `kernel`, `net`, `ui`, `hostname()`, and `reboot`, `shutdown`,
  `reinstall` and `recover`. `hostname()` is the full name, such as
  `STARTHERE.56K.NET`.
