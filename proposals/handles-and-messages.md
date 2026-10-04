# Proposal: handles and messages for SIM95

*Draft, not sent yet.*

A small set of syscalls and one network protocol, for every machine to
have. They are **primitives, not applications**: with them, the following
become ordinary SPARK programs that anyone can write:
* window managers, taskbars and launchers;
* automation and testing tools;
* programs that talk to each other (IPC);
* remote desktop.

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
| see | `Windows`, `Children`, `Info`, `Text`, `Items`, `onWindow` | to every program on the machine |
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
1. `WATCH` and `INFO` give the windows.
2. `CHILDREN` and `TEXT` give their contents. That's text, which redraws
   well over 64K messages; pictures would not.
3. `SEND` carries the clicks and keys back.

## 7. In stages

Each stage is useful without the next:

1. **Handles and seeing** (sections 1 and 2): taskbars, window lists,
   security tools.
2. **Messages** (section 3): window managers, automation, testing.
3. **IPC** (section 4): programs that work together.
4. **The shell service** (section 6): remote administration, remote
   desktop, dashboards over several machines.

## Open questions

* **Controls:** does every control get a handle, or only on request?
  Windows gives every control a handle; that's simple, but costs a little.
* **Menus:** are they controls, for `Select`, or something of their own?
* **Canvases** (games, Sketch): send their drawing as a list of commands,
  or leave them out of remote desktop at first?
* **Where the network rights live:** in `USERS.INI`, beside the password,
  or a file of their own?
