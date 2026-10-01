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
    such as `iesubmit:`, which Internet Explorer relies on.
* **Voyager runs only SPARK scripts.** It ignores
  `<script language="JavaScript">` and `type="text/javascript"`, but treats a
  bare `<script>` as SPARK. So one page can carry SPARK for Voyager and
  JavaScript for Internet Explorer.
* **Handlers interleave.** While one handler waits (`SYS.Sleep`, a message
  box), others run, including another tick of the same timer. Guard shared
  state with a flag.
