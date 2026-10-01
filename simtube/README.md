# SimTube

Movies for [SIM95](https://sim95.kippy.io/). SIM95 has no video codecs, so a
SimTube movie is a **SimMovie** (`.SMV`): plain text, one line of canvas
drawing commands per frame. There are three parts:

* **SimMovie**, the format: keyframes and deltas, cut into 15K parts with a
  manifest so a long movie can travel over a network that carries 64K a
  message.
* **SimPlayer**, the movie player, which lives in [`simplayer/`](../simplayer/):
  built into Simxplorer, and a Vapor app of its own (`C:\PROGRAMS\PLAYER.SPK`)
  for Voyager users.
* **SimTube**, the web site: a front page of movies with pictures and view
  counts, a page for each movie, uploads, stars, comments, accounts and Most
  Viewed. Written in SPARK as ActiveSparkPages, like [SimBook](../simbook/).

It comes with three movies, made by [`tools/make-movies.mjs`](../tools/make-movies.mjs):
*Welcome to SimTube* (the S logo bounces round the screen, and beeps when it
hits a wall), *Dancing Baby* (ooga chaka) and *All Your Base* (the title
cards, typed out a letter at a time).

## Install

1. In SIM95 open **Start > Programs > SPARK**.
2. Paste in the whole of [`INSTALL.SPK`](INSTALL.SPK), save it as
   `C:\MYFILES\INSTALL.SPK`, and press **F5**.
3. Open `http://YOURNAME/` in Voyager. The first visit puts the sample movies
   up.

SimTube becomes the machine's home page: its pages go in `C:\WEB`, and the
stock `INDEX.HTM` moves aside to `WELCOME.HTM`. On a [SimHost](../simhost/)
machine it goes in a folder instead, `http://YOURNAME/tube/`, and leaves the
home page alone. SimHost also moves a SimTube that was the home page into
`/tube/`, movies and all. Running the installer again upgrades the pages
without touching anybody's movies.

SimTube doesn't install a player. **Get SimPlayer** (`getplay.asp`) explains
where it is: built into Simxplorer, and in every Vapor store's Apps section
(or `sim-get install simplayr`).

## Watching

In Simxplorer, a movie page's **Play** link pops up the built-in SimPlayer.
Voyager can't play a movie, so each movie's page also gives its address,
such as `http://alpha/tube/movie.asp?v=2`, to open in SimPlayer on its own:

* type or paste it into SimPlayer's **Address** box and press Enter (or
  **File > Open URL**, Ctrl+L);
* or start SimPlayer with it: `SYS.Start("C:\PROGRAMS\PLAYER.SPK", "http://alpha/tube/movie.asp?v=2")`.

SimPlayer also opens `.SMV` files, and manifests with their parts beside
them, from the disk (**File > Open File**, or the path as its argument).

| Control | |
|---|---|
| **Play / Pause** (Space, or click the picture) | Play from here, or hold |
| **Stop** | Back to the first frame, and stop |
| **Rewind** (Home) | Back to the first frame; keeps playing if it was |
| **<** and **>** (arrow keys) | One frame back or forward, paused |
| Seek bar | Click or drag anywhere in what has arrived so far. The teal part is downloaded |
| **Loop** | Go round again at the end |
| **Mute** | No beeps. SimMovies have no sound track, but they can beep |

The status line says `Buffering... 40%` while the parts come in, then
`Playing  (75% downloaded)`. If playing catches up with the download, it waits
and says `Buffering...` again.

**Timing.** Frames go by `SYS.Ticks`, not by counting timer ticks: the frame
on screen is the one due at this moment, so a movie plays at its own speed
even when the timer can't keep up (frames in between are drawn, not shown).

**Fetching.** One fetch at a time, each started in a timer tick of its own,
inside a `TRY` with an empty `CATCH`, with the answer read through the
socket's `onMessage` and `onClose`. That is the pattern
[SIM95-NOTES](../SIM95-NOTES.md) gives for the kernel bug, and Vapor uses.

## The site

| Page | |
|---|---|
| `index.asp` | Front page: the newest movies, Most Viewed, log in and sign up |
| `watch.asp?v=N` | One movie: its picture, details, views, stars, where to play it, comments; for its owner, Add More Frames |
| `upload.asp` | Upload a `.SMV` (up to 60K), with a title and a few words about it |
| `top.asp` | Most Viewed, top 20 |
| `movie.asp?v=N` | The movie for SimPlayer: its manifest, as `video/x-simmovie` |
| `movie.asp?v=N&p=K` | Part K |
| `thumb.asp?v=N` | Its picture, a SIM95PIC (`image/x-sim95pic`) |
| `getplay.asp` | Where to get SimPlayer (Simxplorer, or Vapor) |
| `simtube.htm` | Help: watching, and the SimMovie format |
| `join.asp`, `login.asp`, `logout.asp`, `rate.asp`, `comment.asp` | Form handlers that redirect back |

* **Pictures.** When a movie goes up, SimTube draws one of its frames into an
  80-pixel-wide `.PIC`, the way SimPlayer would draw it on a canvas: the frame
  named by `thumb=` in its header, or the first. Text comes out as a smudge
  per letter, which at that size is all text ever is.
* **Views** count each visit to a movie's page (not coming back to it after
  rating or commenting).
* **Stars**: one to five, one rating per member; rating again changes it. The
  page shows the average, rounded.
* **Comments**: up to 500 characters, escaped, newest first. A page shows as
  many as fit (up to 30), so it stays well under 64K.
* **Accounts** work like SimBook's: a salted hash rather than the password,
  a session file named by SimTube's own cookie (`simtube`), and a form token on
  every form and action link, checked by every page that changes something.
  You need an account to upload, rate or comment, not to watch.

### Storage

Everything lives in `C:\TUBEDATA`, outside `C:\WEB`, so the web server never
hands it out directly; `movie.asp` and `thumb.asp` do.

```
C:\TUBEDATA\VIDEOS.TXT           id|owner|title|date|frames|fps|width|height|parts|chars|about|author|bg
C:\TUBEDATA\MOVIES\<id>\<n>.SMV  the parts of a movie, 15K at most
C:\TUBEDATA\MOVIES\<id>\THUMB.PIC  its picture
C:\TUBEDATA\VIEWS\<id>.TXT       how many times it has been watched
C:\TUBEDATA\RATINGS\<id>.TXT     |ann=5|bob=3|
C:\TUBEDATA\COMMENTS\<id>.TXT    date time|user|text, oldest first
C:\TUBEDATA\USERS\<user>.TXT     an account, key=value per line
C:\TUBEDATA\SESSIONS\<id>.TXT    sign-in cookie -> user, form token
C:\TUBEDATA\NEXTID.TXT           movie counter
C:\TUBEDATA\SEED\*.SMV           sample movies waiting to go up (SEEDED.TXT: the ones that have)
```

## SimMovie

A `.SMV` file is text. A header, a line holding just `.`, then one line per
frame:

```
SIMMOVIE 1
title=Ball
author=ann
width=160
height=120
fps=10
frames=3
bg=0
thumb=1
about=A red ball rolls.
.
!ball|SIM95PIC 4 2|0CC0|C00C
*C12;D20,60,10
C0;F10,50,21,21;C12;D30,60,10
C0;F20,50,21,21;C12;D40,60,10;S440,50;I70,20,ball
-
```

**Header.** `width` and `height` (16x16 up to 320x240), `fps` (1 to 30),
`frames`, `bg` (the background colour, 0 to 15), and optionally `title`,
`author`, `thumb` (the frame that becomes its picture) and `about`.

**Frames.** Drawing commands separated by `;`, each a letter and its numbers:

| Command | Draws | Canvas call |
|---|---|---|
| `C`*n* | sets the colour (0-15) | `SetColor` |
| `B`*n* | sets the background colour, for `X` | `Background =` |
| `X` | clears the screen | `Clear` |
| `F`*x,y,w,h* / `R`*x,y,w,h* | a filled box / a box | `FillRect` / `Rect` |
| `D`*x,y,r* / `O`*x,y,r* | a filled circle / a circle | `FillCircle` / `Circle` |
| `L`*x1,y1,x2,y2,...* | lines joining the points | `Line` for each |
| `P`*x1,y1,...* | a polygon (closed) | `Line` for each side |
| `Q`*x1,y1,...* | a filled polygon | `Line` for each row |
| `T`*x,y,text* | text, to the end of the command (no `;` in it) | `Text` |
| `I`*x,y,name* | a picture defined earlier | `Picture` |
| `S`*freq,ms* | a beep, unless muted | `SYS.Beep` |

* A frame starting with `*` is a **keyframe**: it starts from a blank screen
  (background `bg`, colour 0). Seeking, stepping back and the thumbnail all
  start drawing from the keyframe before the frame they want.
* Any other frame is a **delta**: it draws over the frame before, so only what
  moves need be drawn again (and rubbed out, with a box in the background
  colour).
* `-` is a frame where nothing changes; a held title card is a row of them.
* A line starting `!` is a **picture**: `!name|SIM95PIC w h|row|row...`, the
  rows of a Sketch `.PIC` joined by `|`. It must come before the frames that
  use it. Lines starting `'` are comments.

The dancing baby is 240 frames in 54K: a keyframe every two seconds, and in
between only the baby is rubbed out and drawn again (and the dance floor every
half second).

### Parts and the manifest

One network message carries 64K, and `HTTPD.SPK` sends a whole file as one.
So a movie is cut into **parts** of at most 15,000 characters, a whole line at
a time, the way [Vapor](../vapor/) cuts its games. Part 1 starts with the
header (with the real frame count); the others are just more lines. A
**manifest** says where they are:

```
SIMMOVIE-PARTS 1
title=Dancing Baby
author=SimTube
width=160
height=120
fps=10
frames=240
bg=0
parts=4
part=movie.asp?v=2&p=1
part=movie.asp?v=2&p=2
part=movie.asp?v=2&p=3
part=movie.asp?v=2&p=4
```

`part=` addresses are relative to the manifest's own (or `/path`, or a whole
`http://` address). A manifest on the disk (any name; `.SML` is a good one)
lists files beside it. SimPlayer reads the manifest, fetches the parts in
order, and plays as soon as it has three seconds in hand.

An upload is one request, so it can be up to 60K. A longer movie goes up in
pieces: upload the start, then send the rest from the movie's page with **Add
More Frames** (the owner only). A piece is the lines that come next; a header
at its top is checked (same size) and skipped. SimTube adds them to the last
part and on into new ones, and puts the new frame count in part 1's header.

### Making movies

`node tools/make-movies.mjs` writes the samples into `MOVIES/`. Its `Movie`
class is a small way to make more:

```js
import { Movie } from "./tools/make-movies.mjs";
const m = new Movie({ title: "Ball", width: 160, height: 120, fps: 10, bg: 0 });
for (let i = 0; i < 50; i++) m.frame(i ? ["C0", `F${i * 2},50,21,21`, "C12", `D${i * 2 + 12},60,10`] : ["C12", "D10,60,10"], i === 0);
fs.writeFileSync("BALL.SMV", m.toString());
```

It also has `parse`, `cut` (the parts) and `calls` (the canvas calls
SimPlayer makes for a frame), which the tests check SimPlayer against.

## How browsers spot a movie

Simxplorer plays these itself (see [its README](../simxplorer/README.md#movies)).
What a browser or program needs to know:

* A movie answers with `Content-Type: video/x-simmovie`. The body starts with
  `SIMMOVIE-PARTS 1` (a manifest) or `SIMMOVIE 1` (a whole movie).
* SimTube's links to movies are `movie.asp?v=N` and carry
  `type="video/x-simmovie"` on the `<a>`, so a browser can decide before it
  fetches. Files ending `.SMV` are movies too (HTTPD.SPK serves them as
  `text/plain`, so look at the first line).
* To play one: `SYS.Start("C:\PROGRAMS\PLAYER.SPK", url)` with the absolute
  address. SimPlayer fetches it and its parts itself, with the
  `User-Agent: SimPlayer/1.0 (SIM95)`.

Playing inside the page itself (an `<embed>`) would need the page view to
hold a canvas; Simxplorer pops up a player window instead.

## Toward Sparkwave

A likely next step is "Sparkwave": small Flash-like games and animations
embedded in a page. The format could grow toward it without breaking old
movies:

* **Labels and jumps.** A `@name` line marks a frame, and a `J`*name* command
  jumps there. With keyframes already meaning "start from a clean screen",
  scenes and loops come almost for free.
* **Buttons.** `H`*x,y,w,h,label* makes a hot spot. A click on the canvas
  (SimPlayer already has `onMouseDown`) jumps to the label. That is enough
  for "click to start", menus, choose-your-own-adventure and quizzes.
* **Keys and variables.** `K`*key,label* for keyboard games, and a few
  numbered variables with `V`*n,expr* and conditional jumps. At that point it
  is a tiny bytecode, and the sensible move is a header saying
  `SIMMOVIE 2` so SimPlayer 1.0 refuses it politely ("This movie needs a
  newer SimPlayer").
* **Sprites.** Pictures are already named and reusable. Moving one is a
  rub-out box and an `I`; a `M`*name,x,y* command that remembers where each
  sprite was could do the rubbing out itself.
* **Embedding.** In Simxplorer, `<embed src="game.smv" width=160 height=120>`
  drawn into a canvas in the page. Voyager runs only SPARK page scripts, which
  have no canvas, so there it would stay a link to SimPlayer.

## Limits

* No sound track: `S` beeps, one at a time, and only on frames that are
  shown (when SimPlayer has to skip frames to keep time, their beeps go).
* Text in the canvas font only, and a movie can't know how wide it is.
* A frame or picture line must be under 14,800 characters (it has to fit in
  a part with room to spare).
* No locking: two uploads at the very same moment could race on
  `VIDEOS.TXT`. `HTTPD.SPK` takes one request at a time, so this is mostly
  theoretical.
* Owners can't delete their movies yet, and Move In doesn't carry
  `C:\TUBEDATA` over.

## Developing

Edit the files in `WEB`, `PROGRAMS`, or the movies in `tools/make-movies.mjs`, then:

```
node tools/make-movies.mjs              # regenerate MOVIES/*.SMV
node tools/build-installer.mjs simtube  # regenerate INSTALL.SPK
node tools/aspsim/simtube.test.mjs      # run the tests
```

The tests boot several headless machines: ALPHA runs SimTube and its web
server, BRAVO runs SimPlayer against ALPHA's disk files and web pages, and
HOST is a SimHost with SimTube in `/tube/`. They count the canvas calls
SimPlayer makes for each frame against the format, time playback, drag the
seek bar, stream with `Buffering...`, upload, rate and comment, and check every
page stays under 64K.
