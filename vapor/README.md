# Vapor

The store for everything on SIM95, in the spirit of a certain other one:

* **Games:** SimDOOM, a raycast 3D shooter; Snake 95; and Half-Life 3,
  coming soon.
* **Programs:** Simxplorer, Frostbird, Clippy.
* **Web apps:** SimBook, ColdMail, AskSim, ELIZA-95.

Vapor installs them, keeps them up to date (itself included), counts your
hours and shows your achievements.

## Setting up a store

Paste `INSTALL.SPK` into SPARK, save it, and press F5 on the machine that
should be the store. It writes:

* `C:\WEB\VAPOR`, the store, which the web server hands out at
  `http://YOURNAME/vapor/`. It holds the catalog, every item cut into parts
  that each fit in a network message, and the store's web site.
* `C:\PROGRAMS\VAPOR.SPK`, the Vapor program, which it starts.

Your home page is left alone. Out of the box, the store has the games and
Vapor itself.

### Stocking the shelves from GitHub: the bridge

The quickest way to fill a store, and to keep it up to date, is
[`tools/vapor-bridge.js`](../tools/vapor-bridge.js). It runs in your real
browser, in the tab where SIM95 is running. It copies every app and game in
this repository onto your machine's shelves, at the newest build.

1. Open SIM95 and let the machine get to its desktop.
2. Open the browser's console (F12, then **Console**).
3. Paste this line and press Enter:

   ```js
   fetch("https://raw.githubusercontent.com/dabbers/sim95/main/tools/vapor-bridge.js").then(r => r.text()).then(eval)
   ```

It prints a table of what it did: each item is `new`, `updated from <build>`,
or `up to date`. Paste it again whenever the repository has changed.

* **What it does:**
  * It reads `vapor/SHELF/SHELF.TXT`, which `tools/build-installer.mjs`
    writes.
  * It fetches everything listed there from one commit.
  * It publishes each item into `C:\WEB\VAPOR` exactly as Publish Apps does:
    parts, then a catalog line.
  * It updates the store's own pages.
* **What it leaves alone:**
  * Items already at the same build aren't touched.
  * Anything else on your shelves stays.
* **A machine that isn't a store** becomes one. Vapor is written to
  `C:\PROGRAMS\VAPOR.SPK` and started.
* **The store's page** says which commit the shelves came from
  (`C:\WEB\VAPOR\BRIDGE.TXT`).
* **Another branch:** put `VAPOR_BRIDGE = { ref: "my-branch" };` in front of
  the line, and use that branch in the URL too.
* **What goes over the network:** only requests to GitHub. One asks GitHub's
  API which commit the branch is at; it allows 60 such requests an hour.
  Without that answer, the bridge fetches by branch name.

Every Vapor that shops at your machine sees the new builds within five
minutes, or at once with **Vapor > Check for Updates**. Each then offers
**Update** for each changed item, and **Update All**.

### Keeping a store up to date by itself: the resident bridge

For a store that's always on, like STARTHERE, the bridge can stay in its
browser tab and do this by itself:
[`tools/bridge-resident.js`](../tools/bridge-resident.js), loaded by a
userscript, [`tools/sim95-bridge.user.js`](../tools/sim95-bridge.user.js).

* **Every 15 minutes** it asks GitHub for the newest commit on `main`. When
  there's a new one, it:
  1. stocks the store from it (it runs that commit's `vapor-bridge.js`);
  2. runs the newer installer of each central-host app the machine has: the
     Pixel Wall, the npm registry, SimNIC and the Welcome Wagon, which aren't
     in the stores;
  3. upgrades what's installed on the machine itself, with Sim Shell's
     `sim-get upgrade -y`, in a Sim Shell window that closes when it's done.
* **From anywhere on the network**, in Sim Shell over ssh:

  ```
  ssh starthere
  bridge                  is it there, what it follows, what it did last
  bridge update           do it now (bridge update force: even if nothing changed)
  bridge log 30           the last 30 lines of what it did
  bridge follow BRANCH    follow another branch; bridge follow main to go back
  bridge every 60         check every 60 minutes (0: only when asked)
  ```

  Over ssh, Sim Shell can't wait on the network, so `bridge update` only
  asks. The bridge picks the request up within a few seconds, and
  `bridge log` follows what it does.

**Setting it up**, once, on the computer whose browser runs STARTHERE:
1. Install Tampermonkey (or Violentmonkey) in that browser.
2. Make a new script, paste in all of `tools/sim95-bridge.user.js`, and save.
3. Reload the SIM95 tab and leave it open.

The script runs the bridge only on the machine named in its `MACHINE` line
(`STARTHERE`). It loads the bridge itself from GitHub each time the tab
loads, so later versions of it arrive by themselves. The console (F12) shows
what it does.

**How they talk:** through files in `C:\SYSTEM\BRIDGE`:
* `ALIVE.TXT`: when the bridge last said it's there;
* `BRIDGE.INI`: what to follow, and how often;
* `REQUEST.TXT`: left by `bridge update`;
* `STATUS.TXT`, `LOG.TXT`: what it's doing, and what it did;
* `DONE.TXT`: the commit and the central apps' builds last brought here.

**Who can use it:** anyone with STARTHERE's user name and password, since
`ssh` here is rsh with a plain password. The most they can do is make the
browser install this repository's own branches: the bridge fetches nothing
but `github.com/dabbers/sim95`.

### Stocking the shelves by hand: Publish Apps

Every `INSTALL.SPK` that `tools/build-installer.mjs` makes starts with a header
line saying what it is:

```
' VAPOR|id=SIMXPLOR|name=Simxplorer|kind=program|version=e87c993a|category=Internet|run=...|files=...|tasks=...|startup=...|about=...
```

To put apps in the store:

1. Paste an app's `INSTALL.SPK` into SPARK on the store machine.
2. Save it in `C:\MYFILES` under any name ending `.SPK`. Don't run it.
3. In Vapor, choose **Vapor > Publish Apps** (Ctrl+P).

Vapor publishes every such installer it finds there. It cuts each one into
parts, writes them to `C:\WEB\VAPOR\<ID>\` and adds the item to the catalog.
Anything already in the store at the same version is left as it is.

To update an app in the store, do the same with its newer `INSTALL.SPK`.
Every build has a new version (a hash of the file), so the new one replaces
the old, and every Vapor that has the app is offered the update. Publish a
newer Vapor (its header says `kind=client`) and every Vapor offers to update
itself.

## Quick start: a new machine in one paste

On a new machine, open **Start > Programs > SPARK**, paste these lines and
press **F5**:

```
VAR t AS String
VAR d AS Bool
SUB Main ()
    VAR s AS NET_Socket
    VAR c AS NET_Connection
    s = NET_Socket.New()
    s.onMessage = Got
    s.onClose = Done
    c = s.Connect("starthere", 80)
    c.Send("GET /vapor/getvapor.asp HTTP/1.0" + Chr(10) + "Host: starthere")
    WHILE NOT d
        SYS.Sleep(50)
    END WHILE
    FS.Write("C:\MYFILES\GETVAPOR.SPK", t.Substring(t.IndexOf(Chr(10) + Chr(10)) + 2, t.Length - t.IndexOf(Chr(10) + Chr(10)) - 2))
    SYS.Run("C:\MYFILES\GETVAPOR.SPK")
END SUB
SUB Got (c AS NET_Connection, m AS String)
    t = t + m + Chr(10)
END SUB
SUB Done (c AS NET_Connection)
    d = TRUE
END SUB
```

That's all. These lines are stage one: they fetch GETVAPOR.SPK (stage two)
from the store on STARTHERE, and run it. GETVAPOR downloads Vapor in parts,
checks it arrived whole, points it at that store and starts it. Then Vapor
installs everything else.

Every store's page shows the same lines with its own name in them, and
`http://STORE/vapor/go.asp` gives them as plain text.

## The download site: getting Vapor

`http://STORE/vapor/` is the store's web site. It has a **Get Vapor** section,
and lists the apps and games on the shelves with their sizes and builds.
There are two ways to get Vapor onto another machine:

* **Save and run.** Open `http://STORE/vapor/getvapor.asp` in Simxplorer and
  choose **File > Save As File**; save it as `C:\MYFILES\GETVAPOR.SPK`. (In
  Voyager, use View Source and save it from Notes.) Then open it in SPARK and
  press F5.
* **Copy and paste.** Copy the same program from the bottom of the page into
  SPARK.

Either way, the program downloads Vapor from the store, already pointed at
that store, and starts it.

## Vapor

* **Store:** Apps, then Games, each with a drawn banner, its kind, size, build
  and blurb.
* **Installing:** a game downloads part by part into
  `C:\GAMES\<ID>\<ID>.SPK`. A program or web app downloads its installer,
  which Vapor runs.
  * A web app asks first: it becomes this machine's home page, and a machine
    has room for one. On a [SimHost](../simhost/) machine, it goes into a
    folder of its own (`/book/`, `/mail/`...) without asking.
* **Library:** **Play** a game, or **Open** a program (a web app opens in the
  browser). Games count play time and show their achievements, which they
  keep in `C:\GAMES\<ID>\ACHIEVE.TXT`.
* **Updates:**
  * Vapor looks at the store again every five minutes.
    **Vapor > Check for Updates** (F5) does it now. The status bar says how
    many updates there are.
  * When the store has a newer build, the Library and the Store mark the item
    "(update)" and offer **Update**.
  * **Vapor > Update All** (Ctrl+U) updates everything.
  * With nothing newer, the Library's button is **Reinstall**. It puts the
    same build back, for anything that has gone wrong.
  * Play time and install dates are kept.
* **Found on this machine:** a program or game whose INSTALL.SPK was pasted
  in by hand is still found. Vapor checks that every file the store lists for
  it is on the disk, and puts it in the Library as "installed without
  Vapor", with an update waiting. **Update All** brings it up to the store's
  build. A web app is found only on a [SimHost](../simhost/) machine, where it
  has a folder of its own. On the home page, another app may have taken its
  place.
* **Uninstall:** stops the program, takes it out of startup, and deletes the
  files its installer wrote. A web app gives the home page back. Saved data,
  such as mail, posts and settings, stays.
* **Change Store** points Vapor at any machine's store.

The library lives in `C:\GAMES\LIBRARY.TXT`.

## SimDOOM

E1M1 on a 320×200 canvas:

* **The view:** a grid raycaster drawing 80 columns of shaded walls.
* **Things:** imps that wake up and chase you, and health and ammo pickups.
* **On screen:** a pistol with a muzzle flash, and a status bar whose face
  looks where you turn.

Arrow keys or WASD move; Space fires; E uses the green exit switch. `IDDQD`
and `IDKFA` work. `-warp` starts you by the exit.

Achievements: First Blood, E1M1 Complete, Rip and Tear, Speedrunner,
Untouchable and Cheater.

## Snake 95

Arrow keys steer and Space pauses. It keeps your best score, and has three
achievements.

Tests: `node tools/aspsim/vapor.test.mjs` and `node tools/aspsim/bridge.test.mjs`. They cover:

* the store and its download site, and fetching Vapor onto another machine;
* publishing apps, installing a program and a web app;
* updates, and Vapor updating itself;
* the bridge: a store stocked from the repository, the same as INSTALL.SPK
  and Publish Apps make one, and its new builds reaching another machine's
  Vapor (Check for Updates, Update, Reinstall, programs found on the disk);
* both games, and uninstalling.

## Domain names

A store can be at a name: **Change Store...** `fun.sim` (that is
`http://fun.sim/vapor/`) or `http://shop.fun.sim/vapor/`. Vapor asks the
central name server (STARTHERE.56k.net, see [simweb](../simweb/)) where it
is, in a tick of its own, then fetches the catalog, the parts and its own
updates from that machine with `Host:` saying the name, so a web server with
sites by name finds the store. The builder joins the resolver onto the Vapor
program. Every store stocks [simweb](../simweb/), the way it stocks
SimPlayer. GETVAPOR (getting Vapor itself with Voyager) still goes by
machine name.
