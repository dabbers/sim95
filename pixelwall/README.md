# The Pixel Wall

One wall of pixels that the whole network draws on together, like Reddit's
r/place. It is 64 by 64 pixels in SIM95's 16 colours, and lives on the central
host: `http://starthere.56k.net/wall/`.

* **Placing a pixel:** pick a colour, then click a square. Each machine can
  place one pixel every 15 seconds.
* **Seeing the wall:** a page shows a 16 by 16 part of it to click on, and the
  whole wall as a picture. Parts are named A1 to D4, like a map.
* **Who drew what:** the latest pixels are listed under the colours, by
  machine name ("ALPHA put Red at 20,17").

## In Voyager and in Simxplorer

| | Voyager | Simxplorer |
|---|---|---|
| Placing a pixel | each square is a link | click anywhere in a square |
| After placing | the page reloads | the square changes without reloading |
| Other people's pixels | the page reloads itself every 30 seconds | they appear within a few seconds |
| The wait | "Next pixel in 12 seconds" | counts down |
| Another part, another colour | a link (reloads the page) | instant |

Simxplorer gets the plain page too with `?plain=1`, and there's a link to it at
the bottom of the page.

## How it works

* `INDEX.ASP` is the page.
  * **Voyager** gets plain HTML. Each square is a link to `PLACE.ASP` holding a
    one-colour picture (`C0.PIC` to `CF.PIC`, a 1 by 1 picture drawn 20 pixels
    wide). Voyager underlines the text in a link, but not a picture, and asks
    for each picture once a page.
  * The colour in use has a dot in it (`S0.PIC` to `SF.PIC`).
  * A page script reloads the page every 30 seconds.
* **Simxplorer** gets the same page drawn by JavaScript, `WALL.JS`:
  * Its JavaScript can change a page's text, but not its colours. So when the
    wall changes, the script writes the whole page again with
    `document.write`. The new page carries the wall and the script with it,
    and draws itself.
  * Pixels are placed, and parts of the wall fetched, with `XMLHttpRequest`.
  * Every 4 seconds it asks `DATA.ASP` whether the wall has changed.
* The other pages:
  * `PLACE.ASP` places a pixel. From a link it goes back to the page; to
    `XMLHttpRequest` it answers in plain text.
  * `WALL.ASP` is the whole wall as a 64 by 64 picture.
  * `WALL.SPK` has what the pages share.
* The wall is kept in `C:\WALLDATA`:
  * `WALL.TXT` is 64 lines of 64 hex digits.
  * `VER.TXT` goes up with every pixel.
  * `COOL.TXT` says when each machine last placed a pixel.
  * `LOG.TXT` has the latest pixels.
  * `NAMES.TXT` remembers machine names by address.
  * Two pixels at once wait their turn, behind a lock folder.

## Installing

On STARTHERE: paste `INSTALL.SPK` into SPARK and press F5. It puts the pages in
`C:\WEB\WALL` and makes a white wall the first time. Running it again upgrades
the pages and keeps the wall. On any other machine it asks first, since a
second wall would split the people drawing.

It isn't in the Vapor stores, as there's only one wall. Because it's listed on
STARTHERE's front page, the Welcome Wagon tells newcomers about it.

Tests: `node tools/aspsim/pixelwall.test.mjs` installs it, places pixels from
Voyager on several machines, and uses it in Simxplorer.
