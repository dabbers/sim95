# Vapor

A games store and library for SIM95, in the spirit of a certain other one,
and **SimDOOM**, a raycast 3D shooter to go in it, plus **Snake 95**.
(Half-Life 3 is in the store too. It's coming soon.)

## Installing

Paste `INSTALL.SPK` into SPARK, save it, and press F5 on the machine that
should be the **store**. It writes:

* the store's files in `C:\WEB\VAPOR`, served by the web server at
  `http://YOURNAME/vapor/`: a catalog, and every game cut into parts that
  fit in a network message;
* the Vapor program, `C:\PROGRAMS\VAPOR.SPK`, which it starts.

Your home page is left alone.

On **other machines**, open `http://STORE/vapor/` in Simxplorer or Voyager. The
store's page lists its games, and has a short program (GETVAPOR) to paste into
SPARK. It downloads Vapor from the store and starts it, already pointed at that
store.

## Vapor

* **Store:** every game with a drawn banner, its genre, size and blurb.
  Install queues a download.
* **Downloads:** each game comes down part by part, with a progress bar and
  speed. It's then put together in `C:\GAMES\<ID>\<ID>.SPK`.
* **Library:**
  * Play starts the game. Vapor counts the time played while it runs
    ("Played 12 minutes").
  * It shows the game's achievements, which games write to
    `C:\GAMES\<ID>\ACHIEVE.TXT`.
  * Uninstall removes the game.
* **Change Store** points Vapor at any machine running a Vapor store.

## SimDOOM

E1M1 on a 320×200 canvas:

* **The view:** a grid raycaster drawing 80 columns of shaded walls (stone,
  brick, wood, and the green exit switch).
* **Things:** imps that wake up and chase you, health packs and ammo, all
  drawn as billboards clipped behind walls.
* **On screen:** a pistol with a muzzle flash, and a status bar with ammo,
  health, kills and the face that looks where you turn and bleeds when
  you're hurt.

Arrow keys or WASD move; Space fires; E uses the switch. `IDDQD` and `IDKFA`
work. `-warp` (as an argument) starts you by the exit.

Achievements:

* First Blood
* E1M1 Complete
* Rip and Tear (every imp)
* Speedrunner (under a minute)
* Untouchable
* Cheater

It draws only when something changes, at about 23 ms a frame in the test
harness. Clippy notices when you play it.

## Snake 95

Arrow keys steer and Space pauses. It keeps your best score, and has three
achievements.

Tests: `node tools/aspsim/vapor.test.mjs`. It installs the store on one
machine, fetches Vapor onto another from the store's page, downloads and plays
both games, and checks play time, achievements and uninstalling.
