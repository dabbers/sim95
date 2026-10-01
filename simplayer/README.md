# SimPlayer

The movie player for SIM95, in the style of the 1998 players. It plays
SimMovies (`.SMV`, see [SimTube](../simtube/README.md)) from your disk, or
streams them from the web, starting as soon as a few seconds are in.

* **Controls:** Play/Pause, Stop, Rewind, a frame at a time (`<` and `>`), a
  seek bar to click or drag (it shows how much has arrived), a time display,
  Loop, and Mute (SimMovies beep).
* **Opening a movie:** the Address box, **File > Open URL** (Ctrl+L), **File >
  Open File** (Ctrl+O), or start it with a movie as its argument:
  `SYS.Start("C:\PROGRAMS\PLAYER.SPK", "http://alpha/tube/movie.asp?v=2")`.

## Getting it

* **Simxplorer has it built in.** Click a movie link and a SimPlayer window
  pops up. Nothing to download.
* **On its own,** it's a Vapor app: every Vapor store stocks it in the Apps
  section, or type `sim-get install simplayr` in the Sim Shell. Or paste
  [`INSTALL.SPK`](INSTALL.SPK) into SPARK and press F5. It writes
  `C:\PROGRAMS\PLAYER.SPK` and starts it.

## One player, two places

The source is [`src/PLAYER.SPK`](src/PLAYER.SPK). The standalone program is
that file. Simxplorer gets the same file built in by
[`tools/simxplorer-source.mjs`](../tools/simxplorer-source.mjs). It renames
every top-level name `Mv...`, because a SPARK program has one namespace and
names like `win` and `state` are the browser's too. Simxplorer then calls
`MvOpenPlayer(url, TRUE)`: the player opens as a window of the browser's,
and closing it closes just that window.

Tests: `node tools/aspsim/simtube.test.mjs` (the player) and
`node tools/aspsim/simxplorer.test.mjs` (built in).

## Domain names

A movie can be at a name, like `http://movies.coolsite.sim/dance.smv`.
SimPlayer asks the central name server (STARTHERE.56k.net, see
[simweb](../simweb/)) which machine that is, in a tick of its own, then
fetches from that machine with `Host: movies.coolsite.sim`. The builder joins
the resolver (`simweb/src/RESOLVE.SPK`) onto `PLAYER.SPK`; the SimPlayer built
into Simxplorer uses the browser's copy instead, so the two share one answer.
With no answer, the name is a machine name, as before.
