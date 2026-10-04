# Proposal: handles and messages for SIM95

*Draft, not sent yet.*

A small set of syscalls and one network protocol, for every machine to
have. They are **primitives, not applications**: with them, the following
become ordinary SPARK programs that anyone can write:
* window managers, taskbars and launchers;
* automation and testing tools;
* programs that talk to each other (IPC);
* remote desktop and screen sharing;
* replacement desktops: taskbars, docks, launchers, whole shells.

The idea is the one Windows is built on: everything is a *handle*, and you
work with a handle by *sending it messages*.

SIM95 is most of the way there already:
* `SYS.Tasks()` lists processes by pid, and counts each one's windows.
* `SYS.Kill(pid)` acts on a process by its number.
* Every window and control already has an internal id; the desktop uses it
  to track focus.
* SPARK programs already work by events (`onClick`, `onKey`...).

This proposal exposes those ids, and lets one program fire another
program's events, with permission checks.

**One principle runs through it: no program has powers the others lack.**
That includes the desktop itself (section 7). Anything the built-in parts
of SIM95 do, a SPARK program can do the same way, so anyone can build the
next thing without waiting for it to be built in.

## 1. Handles

A **handle** is an integer that names a kernel object.

| Kind | What it is |
|---|---|
| `window` | a top-level window |
| `control` | a button, text box, list... inside a window; its parent is that window |
| `process` | a running program; its handle is its pid, as now |
| `name` | a named endpoint a program registered (section 4) |

Rules:
* **A handle is never reused while it could still be held.** Put a
  generation count in the number, so a stale handle fails rather than
  reaching a new window that got the old number. Windows learned this the
  hard way.
* **A handle dies with its object.** A program's handles go when it
  exits; a window's go when it closes.
* **A program's own handles are always usable.** Other programs' handles
  need a right (section 5).

## 2. Seeing

```
SYS.Windows() AS Array OF Integer           every top-level window, hidden ones included
SYS.Children(h AS Integer) AS Array OF Integer   the controls inside a window, in order
SYS.Info(h AS Integer) AS String            "pid|kind|type|title|x|y|w|h|state|visible|enabled"
SYS.Text(h AS Integer) AS String            a control's text (a text box's contents, a label's words)
SYS.Items(h AS Integer) AS Array OF String  a list's items
```

* `type` is the SPARK class (`GUI_Button`...); `state` is `normal`,
  `minimized` or `maximized`.
* **Hidden windows are listed**, with `visible=0`. A windowless program in
  `C:\SYSTEM\STARTUP` is otherwise invisible except in Tasks. With
  file sharing open on port 139 by default, Task Manager and security tools
  should be able to show it.

Events, so nothing has to poll. The program asks for them once, with
`SYS.Watch(TRUE)`:

```
onWindow(h AS Integer, what AS String)      what: open, close, move, state, title, focus
```

### Watching everything that changes

Window events say when windows come and go. To keep a faithful copy of a
window, a program also needs to know when anything *inside* it changes:
* a label's text;
* a list's items;
* a check box;
* a progress bar;
* a control appearing, moving or going.

```
SYS.Watch(h AS Integer, TRUE)                     everything in window h
onProperty(h AS Integer, name AS String, value AS String)
onControl(h AS Integer, what AS String)           what: add, remove
```

* **Where it comes from:** SIM95 already marks a control as changed on every
  property change; that's what redraws the screen. These events come from
  the same place.
* **Everyone sees the same changes:** the screen, a remote viewer, an
  automation script and a screen reader all get them.

### Canvases

A Canvas already keeps the list of drawing calls made on it since it was
last cleared: `Line`, `FillRect`, `Text`, `Picture`. So:

```
SYS.Drawing(h AS Integer) AS Array OF String   the calls since the last Clear, one a line
onDrawing(h AS Integer, call AS String)        each new call, while watched
```

These are drawing commands, not pixels. They are small, exact and the same
at any size. Windows' remote desktop worked this way before it sent
pictures.

Between them, the window tree, the change events and the drawing commands
capture **everything on the screen**. No screenshots are needed, because
the screen *is* this data.

## 3. Doing: messages

```
SYS.Send(h AS Integer, name AS String, data AS String) AS String   waits for the answer
SYS.Post(h AS Integer, name AS String, data AS String)             doesn't wait
```

**Built-in messages** do what the user would. They fire the same SPARK
events the real interface fires, so the receiving program can't tell the
difference:

| Message | To | Does |
|---|---|---|
| `Move` | window | `data` = `x,y,w,h` |
| `State` | window | `normal` / `minimized` / `maximized` |
| `Focus` | window or control | brings it to the front and focuses it |
| `Close` | window | as the close box: its `onClose` runs |
| `Click` | control | as a click: `onClick` |
| `SetText` | control | sets its text: `onChange` |
| `Key` | window or control | a key, as SPARK names keys: `onKey` / `onEnter` |
| `Select` | list or menu | an item: `onSelect` |

**Waiting must time out.** In Windows, `SendMessage` to a frozen program
froze the sender too, which is why `SendMessageTimeout` exists. SIM95
already knows when a program is "Not responding": `Send` to one should
fail at once, and any `Send` should fail after a few seconds without an
answer.

**Size:** `data` and answers are at most 64K, like a network message.

## 4. Programs talking to each other (IPC)

**Custom messages.** Any message name that isn't built in goes to the
receiving program as an event:

```
SUB X_OnMessage (from AS Integer, name AS String, data AS String) AS String
```

* `from` is the sender's handle, so it can answer later with `Post`.
* The handler's return value is the answer to the sender's `Send`.

**Finding each other by name**, not by window title, which changes:

```
SYS.Register(name AS String) AS Integer   a named handle for this program (fails if taken)
SYS.Find(name AS String) AS Integer       a registered name's handle, or 0
```

Windowless services can register a name, so they don't need a hidden window
to be reachable.

Examples, from programs that exist now:
* Vapor tells Simxplorer `OpenUrl http://starthere/vapor/`.
* Frostbird asks Simxplorer to open a link from a letter, and Simxplorer
  asks Frostbird to write one (`mailto:`). Today these go through files
  and program arguments.
* Clippy hears what other programs actually do, rather than guessing.
* A control panel drives a service (the chat greeter, a web server)
  without going through chat or files.

## 5. Permissions

| Right | Covers | Granted |
|---|---|---|
| see | `Windows`, `Children`, `Info`, `Text`, `Items`, `Drawing`, `onWindow`, `onProperty`, `onControl`, `onDrawing` | to every program on the machine |
| manage | `Move`, `State`, `Focus`, `Close` | to every program on the machine (it's what the taskbar does) |
| input | `Click`, `SetText`, `Key`, `Select` | only when the owner allows it: once per program, remembered in `C:\SYSTEM\RIGHTS.INI` |
| message | custom messages | to every program, but a receiver can refuse by its return value |

Whatever the rights are, they should be checked in one place: when a
handle is used. Then every syscall follows them.

## 6. The network: a shell service

Every machine runs one, like Files (139) and Chat (6667). Port 135 would
fit (Windows' RPC). One message each way, like the Files service:

```
-> AUTH name|password             the machine's account, as for port 139
<- OK
-> WINDOWS                        <- OK + one handle a line
-> CHILDREN h / INFO h / TEXT h / ITEMS h
-> SEND h name data               <- OK + the answer, or ERR why
-> POST h name data
-> WATCH                          <- WINDOW h what, as things happen
-> WATCH h                        <- PROP h name value / CTRL h what / DRAW h call
-> DRAWING h                      <- OK + its drawing calls
```

* **A remote handle is machine + handle.** A SPARK wrapper could make
  `SYS.Send` take `"alpha:1234"`, or there could be `NET_Shell` like
  `NET_Socket`.
* **The owner is asked**, as they are for input:
  "STARTHERE wants to see this computer's windows" (or "and control
  them"). Allow once, always, or never. "See" and "control" are separate.
* **While someone is connected, it shows:** a tray icon, and a coloured
  border round the screen while someone is in control.

Remote desktop is then an app:
1. `WINDOWS`, `CHILDREN` and `INFO` give the windows and what's in them.
2. **The viewer builds the same controls locally,** from that information.
   * Remote windows look native and stay sharp at any size.
   * Only changes cross the network after that: `PROP`, `CTRL`, and `DRAW`
     for canvases. That's text, which fits well in 64K messages; pictures
     would not.
3. `SEND` carries the clicks and keys back.
   * They go through the same steps as a person's own input (see
     `input-and-interaction.md`), so the remote program can't tell the
     difference.

The same pieces make other things:
* screen sharing that only watches;
* a teacher seeing several machines at once;
* a recorder that saves a session as text and plays it back;
* a screen reader;
* tests that check what a program shows.

## 7. The desktop is a program

Today the desktop, taskbar and Start menu are built into SIM95. Instead, the
shell can be an ordinary SPARK program, like Explorer in Windows:
* chosen in `C:\SYSTEM\SYSTEM.INI`;
* edited, closed and run again like anything else;
* with handles like anything else, so it can be watched, captured and sent
  messages.

The current desktop would be the first such program. It would ship as SPARK
source anyone can read, copy and change.

The few things only a shell needs, all general enough for docks, kiosks and
launchers too:

| Primitive | What it does |
|---|---|
| `shell=` in `[boot]` of `SYSTEM.INI` | the program started as the desktop, as in Windows 3.1 and 95 |
| `GUI_Window.Style = "desktop"` | full screen, behind every other window, no title bar, not on the taskbar |
| `SYS.ReserveEdge(edge, size)` | keeps a strip of the screen that windows don't cover when maximized: taskbars, docks, toolbars |
| `SYS.Hotkey(key)` | a key combination that reaches this program from anywhere: Ctrl+Esc for Start, Alt+Tab |
| handles, `onWindow`, `SYS.Send` (sections 2-4) | the taskbar's buttons, and what they do |
| popup windows (`input-and-interaction.md`) | the Start menu and its sub-menus |
| `SYS.Register` / `SYS.Find` (section 4) | other programs find the tray, and send it their icons as messages |

**A shell has no other special powers.** So a new shell can be run as an
ordinary window while the current one stays in charge:
* it lists the windows, switches between them and starts programs;
* `ReserveEdge` and `Hotkey` simply do nothing for a program that isn't the
  shell, so it can be tested and restarted;
* once it works, it goes in `SYSTEM.INI`.

People ran replacement shells the same way on Windows 3.1.

**Nothing here protects anyone,** in keeping with SIM95: a broken shell
breaks the machine, like deleting system files does. Two things from
Windows 95 make developing one bearable:
* **Ctrl+Alt+Del is handled by SIM95 itself,** not the shell, as it was by
  Windows. So Task Manager still opens when the shell has died, and the
  shell can be started again from it.
* **Safe Mode:** holding a key at boot (F8, as in 95) starts the built-in
  desktop and skips `C:\SYSTEM\STARTUP`.
  * It changes no files, so the developer fixes `SYSTEM.INI` or the shell
    and reboots normally.
  * Full recovery stays for real disasters.

## 8. In stages

Each stage is useful without the next:

1. **Handles and seeing** (sections 1 and 2): taskbars, window lists,
   security tools.
2. **Messages** (section 3): window managers, automation, testing.
3. **IPC** (section 4): programs that work together.
4. **Watching everything** (the rest of section 2): faithful copies of
   windows, recorders, screen readers, testing.
5. **The shell service** (section 6): remote administration, remote
   desktop, dashboards over several machines.
6. **The desktop as a program** (section 7): replacement shells, docks,
   kiosks.

## Open questions

* **Controls:** does every control get a handle, or only on request?
  Windows gives every control a handle; that's simple, but costs a little.
* **Menus:** are they controls, for `Select`, or something of their own?
* **Canvases with a lot of drawing** (games redrawing every frame): send
  every call, or let the viewer ask for a snapshot of the call list now and
  then?
* **Which key opens Safe Mode,** and does the boot screen show it?
* **Where the network rights live:** in `USERS.INI`, beside the password,
  or a file of their own?
