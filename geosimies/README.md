# GeoSimies

*Free homepages for the whole SIM95 network!*

A homesteading community in the spirit of 1997 GeoCities. Sign up, move in to
a neighborhood, get an address of your own, and build your homepage in the
browser from a template full of marquees, blinking text, starry skies and
under-construction signs. Every homepage gets a hit counter, a guestbook and
webrings. It is written in SPARK as ActiveSparkPages (`.ASP`) served by the
machine's own `HTTPD.SPK`.

## Install

Paste [`INSTALL.SPK`](INSTALL.SPK) into SPARK, save it, press **F5**, and open
`http://YOURNAME/`. GeoSimies becomes the machine's home page; the stock
`INDEX.HTM` moves aside to `WELCOME.HTM`. On a [SimHost](../simhost/) machine
it goes in a folder of its own instead: `http://HOST/geo/`. Running the
installer again upgrades the pages and leaves everybody's homepages alone.

## Neighborhoods and addresses

Every homepage lives in a neighborhood, at a number:

| Neighborhood | What lives there |
|---|---|
| Area95   | UFOs, aliens, outer space, sci-fi |
| Simwood  | Movies, TV, fan pages for the stars |
| ChipVale | Computers, programming, SPARK |
| Hometown | Family, pets, hobbies, recipes |
| NeoTokyo | Anime, manga, video games |
| RockCity | Bands, concerts, lyrics |
| Stadium  | Sports and teams |
| Toyland  | Kids, toys, cartoons |

Addresses run from 1001 to 9999. Pick one, or take the next free one. Ann's
homepage at Area95 1001 is `http://HOST/area95/1001/` (`/geo/area95/1001/`
on SimHost), for good. `/~ann/` is the short way there: `~` is allowed in SIM95
file names, so `~ANN` is a folder. That is why member names are 3 to 7
letters or digits, so the folder name still fits in eight.

## What it does

| Page | |
|---|---|
| `index.asp` | Front page: Cool Site of the Day, the neighborhoods, who just moved in, log in |
| `signup.asp`, `join.asp` | Pick a neighborhood, an address and a template, and move in |
| `edit.asp` | Your homepage: pages, title and description; `?p=name` is the page editor |
| `upload.asp` | Add a picture, and the clip art library |
| `guest.asp?h=area95&n=1001` | A homepage's guestbook: read it, sign it |
| `hood.asp?h=area95` | The directory: every homepage in a neighborhood |
| `rings.asp`, `ring.asp?r=1` | Webrings: start one, join one, and the ring's own page |
| `geosimie.htm` | About GeoSimies, for people and search engines |

* **The editor** is a text box with your HTML in it. **Preview / Save** shows
  the page at its real address with a yellow PREVIEW bar, which only you
  see; **Publish it!** puts it on the Web. Tick *Save it straight away* to
  skip the preview. A homepage has up to 6 pages (`index` plus five more,
  like `links.asp`), and you can start any of them over from a template.
* **Templates:** Starry Night (black sky, stars, a marquee and a globe that
  really turns, by a SPARK page script swapping four pictures), Under
  Construction, Fan Shrine and Plain Paper.
* **Clip art** in `clipart/`: under construction, e-mail me, the globe (and
  its four turns), NEW!, a strip of stars, a rainbow line, Cool Site of the
  Day, and *Best viewed in Simxplorer*. Pages use them as
  `<img src="../../clipart/undercon.pic">`.
* **Pictures:** up to 10 `.PIC` files of your own, each up to 200 by 200 and
  40K, so the upload fits in Voyager's 64K. They sit beside your pages:
  `<img src="me.pic">`.
* **Hit counter:** put `<!--COUNTER-->` in a page and it becomes *You are
  visitor #000123* on black odometer wheels. The count goes up on the
  server, each time the page is sent. Your previews don't count.
* **Guestbook:** a link to it goes at the bottom of every page. Names are up
  to 40 characters, "where from" 60, messages 500. The newest 200 are kept,
  and you can delete entries from your own.
* **Webrings:** at the bottom of a member's page, for every ring it's in:
  `[ << Prev | Ring Name | Next >> | Random ]`. Next from the last member
  goes round to the first, and Random never picks the page you're on. A
  homepage can be in 5 rings.
* **For AskSim:** the front page links every neighborhood, and each
  neighborhood links its homepages (a screenful of them), so the crawler
  finds them. A page
  without a `<title>` or a description gets the ones from *Title and
  Description*.

## How a homepage is served

The pages people write never sit in `C:\WEB`. For each page, the homepage's
folder holds the same three lines:

```
<%@ import file="..\..\GEO.SPK" %>
<% ' A GeoSimies homepage: GEO.SPK finds whose from where this file is.
ShowPage() %>
```

`ShowPage` works out the neighborhood, number and page from the file's own
path, reads the member's HTML from `C:\GEODATA`, counts the visit, turns
`<!--COUNTER-->` into the odometer, and puts the webrings and guestbook links
in before `</body>`. No member's text is ever written into an `.ASP` file.

## Security

* **Escaping:** a member's HTML is theirs on their own homepage, and nowhere
  else. In the editor it is escaped inside the text box. Titles,
  descriptions, ring names and every guestbook entry are escaped wherever
  they appear.
* **JavaScript is switched off on homepages.** Every homepage is served from
  the same machine as everybody's sign-ins (and on SimHost, SimBook's and
  ColdMail's too), and Simxplorer's JavaScript can read `document.cookie`. So
  as a page goes out, each `<script>` becomes `<script type="spark">` (a SPARK
  page script sees only the page), an `onclick` or other `on...` that is more
  than the name of a SUB is renamed (`noclick`) so it does nothing, and a tag
  with `javascript:` in it, or an `&#` entity that could hide it, is dropped.
  Tags are cut out the way Simxplorer cuts them, from `<` to the next `>`.
  Voyager's SPARK page scripts work as usual.
* **Accounts:** passwords are salted and hashed as in SimBook. The cookie is
  `geosimies`. A session is only good from the machine that signed in (its
  address is on the session's third line), so a cookie that got out can't be
  used elsewhere.
* **Forged requests:** every form that changes something carries the
  session's form token (`t`), checked by `RequireToken`, as in SimBook. That
  includes logging out, and the owner deleting a guestbook entry. Signing a
  guestbook is open to everybody, so it needs none.
* **Data** lives in `C:\GEODATA`, outside `C:\WEB`.

## Storage

```
C:\GEODATA\USERS\<user>.TXT              member: name, salt, hash, neighborhood, number
C:\GEODATA\SESSIONS\<id>.TXT             user, form token, address signed in from
C:\GEODATA\MEMBERS.TXT                   user|hood|number
C:\GEODATA\HOODS\<hood>.TXT              number|user|title|description|updated
C:\GEODATA\NEWEST.TXT                    hood|number, as they moved in
C:\GEODATA\SITES\<hood>\<n>\<page>.HTM   a page (.DRF: its preview, .CNT: its counter)
C:\GEODATA\SITES\<hood>\<n>\GUEST.TXT    number|date|name|from|message
C:\GEODATA\SITES\<hood>\<n>\RINGS.TXT    |1|3|  its webrings
C:\GEODATA\RINGS.TXT                     id|founder hood/number|name|description
C:\GEODATA\RINGS\<id>.TXT                hood/number, one member per line, in ring order
C:\GEODATA\WHERE.TXT                     where GeoSimies was last (see below)
C:\WEB\<hood>\<n>\<page>.ASP, <pic>.PIC  what is served
C:\WEB\~<user>\INDEX.ASP                 sends /~ann/ to Ann's address
```

## The 64K limit

Voyager sends a request as one network message and `HTTPD.SPK` sends a page as
one, both at most 64K. A page holds 16,000 characters, and at most 40,000 once
escaped for the editor (every `<` is `&lt;`), so the editor, the request that
saves it and the page itself all fit; the worst page allowed makes an editor
page of about 45K. The text box counts down as you type and greys out the
button when it's over. Guestbooks, the directory and webrings stop at a
screenful.

## On SimHost

Installed after SimHost, GeoSimies goes in `C:\WEB\GEO` and SimHost's front
page lists it. If it was the home page first, SimHost moves it into
`C:\WEB\GEO` with the neighborhoods' folders; the `/~name/` shortcuts are put
right the first time somebody opens `/geo/` (GeoSimies notices it has moved
from `C:\GEODATA\WHERE.TXT`). Move In doesn't copy GeoSimies yet.

## Caveats (it is a toy)

* The JavaScript filter is a filter, not a sandbox. It follows Simxplorer's
  rules as they are; a browser that ran script some other way would need
  another look. Once Simxplorer has XMLHttpRequest, a script slipping through
  could read pages with the form token in them.
* The password hash is home-made: SIM95 has no cryptography.
* There is no locking. HTTPD handles one request at a time.
* Signing up and logging in carry no form token.

Tests: `node tools/aspsim/geosimies.test.mjs`. They cover signing up and
claiming addresses, the editor and previews, the counter, guestbooks,
webrings going round, escaping and the JavaScript filter, the 64K limits,
pictures, forged requests, and GeoSimies at the root, in `/geo/` on a SimHost
machine, and moved there by SimHost.
