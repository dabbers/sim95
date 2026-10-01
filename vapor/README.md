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

### Stocking the shelves, and updating them: Publish Apps

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
    has room for one.
* **Library:** **Play** a game, or **Open** a program (a web app opens in the
  browser). Games count play time and show their achievements, which they
  keep in `C:\GAMES\<ID>\ACHIEVE.TXT`.
* **Updates:** when the store has a newer build, the Library and the Store
  mark it "(update)" and offer **Update**. **Vapor > Update All** (Ctrl+U)
  updates everything. Play time and install dates are kept.
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

Tests: `node tools/aspsim/vapor.test.mjs`. It covers:

* the store and its download site, and fetching Vapor onto another machine;
* publishing apps, installing a program and a web app;
* updates, and Vapor updating itself;
* both games, and uninstalling.
