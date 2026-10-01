# SimStats

Web statistics for [SIM95](https://sim95.kippy.io/), the way Hitbox and Urchin
did it in 1998: Google Analytics before Google. Paste a tag into your pages,
on any machine, and SimStats counts who comes: hits, unique visitors, top
pages, referrers, browsers, hours of the day, the machines they came from,
and the last 20 hits as they happen. There's an 88x31 LED hit counter too.
Written in SPARK as ActiveSparkPages, like [SimBook](../simbook/).

## Install

1. In SIM95 open **Start > Programs > SPARK**.
2. Paste in the whole of [`INSTALL.SPK`](INSTALL.SPK), save it as
   `C:\MYFILES\INSTALL.SPK`, and press **F5**.
3. Open `http://YOURNAME/` in Voyager, sign up, and add a site.

SimStats becomes the machine's home page: its pages go in `C:\WEB`, and the
stock `INDEX.HTM` moves aside to `WELCOME.HTM`. On a [SimHost](../simhost/)
machine it goes in a folder instead, `http://YOURNAME/stats/`, and the SimHost
front page counts its own visitors with it. Running the installer again
upgrades the pages without losing a hit.

The installer also:

* makes a site for the machine itself, **This machine (YOURNAME)**, which
  belongs to nobody. Its id is in `C:\STATDATA\HOME.TXT`, and the SimHost
  front page's tag counts into it. The machine's owner sees it on the overview
  (`admin.asp`), and can hand it to an account there;
* adds `Disallow: /hit.asp` (or `/stats/hit.asp`) to `C:\WEB\ROBOTS.TXT`, so
  AskSim's crawler leaves the tag alone. `hit.asp` doesn't count crawlers
  anyway, and every dashboard says `<meta name="robots" content="noindex,nofollow">`.

## The tag

Each site gets an id of 8 hex digits. **Get the code** (`code.asp`) gives
three ways to count a page:

1. **The plain tag**, an invisible one-pixel picture. It works in every
   browser, and GeoSimies lets members paste it into their homepages:

   ```html
   <img src="http://alpha/hit.asp?s=1A2B3C4D&p=/index.htm" width="1" height="1" border="0" alt="">
   ```

   `p` is the page. Voyager sends no `Referer`, so the tag has to say it
   itself: code.asp makes a tag for whatever page you type.
2. **The JavaScript tag**, for Simxplorer. Its script writes the picture with
   `location.pathname`, `document.title` and `document.referrer` (and a
   cache-buster, since Simxplorer keeps pictures it has seen). Voyager ignores
   `<script language="JavaScript">` and draws what's in `<noscript>`: the
   plain tag. Simxplorer drops `<noscript>`. So everybody counts once.
3. **The counter** (`&b=1`): the same, but the picture is an 88x31 badge,
   your total hits in green LED digits over "VISITORS" and "SIMSTATS". It
   links to your public stats, if you have them.

`hit.asp?s=ID&p=PATH&t=TITLE&r=REFERRER` always answers `200` with a picture
(`Content-Type: image/x-sim95pic`), even for an id it doesn't know, a site
that is paused, a crawler (`AskSim/...`), or a visitor who opted out. It just
doesn't count those. `&n=1` draws the counter without counting (the preview
on code.asp).

### What the browsers really do

Read from the bundle's Voyager (and `simxplorer/src/BROWSER.SPK`), and tested
in `tools/aspsim/simstats.test.mjs`:

* **Voyager fetches a picture from any machine**, not just the page's: every
  `<img src>` goes through the same fetch as a page, to whatever host the
  address names. It shows it if the answer is under 400 and starts with
  `SIM95PIC`.
* **Voyager sends the picture's host's cookies**, from its one jar
  (`C:\SYSTEM\COOKIES.TXT`, by host name as typed in the address), and keeps
  a `Set-Cookie` that comes with a picture. So third-party cookies work: the
  stats machine's `ssvid` cookie comes back from every page that carries the
  tag. It sends `User-Agent: Voyager/1.1 (SIM95)` and never a `Referer`.
* Voyager draws `<noscript>` (it doesn't know the tag), and never draws
  `<script>`. It has no `<meta http-equiv="refresh">`.
* **Simxplorer** shares Voyager's jar, so it sends and keeps the same
  cookies. It sends `Referer` only for pages, not pictures. It drops
  `<noscript>`, and keeps up to 40 pictures it has already fetched, so a
  plain tag on a page seen again isn't fetched (or counted) again. The
  JavaScript tag adds `&z=` and the time, so it is.

## Counting

* **Hits**: every time the picture is fetched.
* **Unique visitors**: `hit.asp` hands each browser a visitor number in a
  cookie (`ssvid`) on the stats machine. Voyager and Simxplorer share one jar,
  so a machine's two browsers are one visitor. A program that sends no
  cookies is counted once per machine per day: the number handed to its
  address that day is used again. Over 7 or 30 days, visitors are counted
  once across the days.
* **Browser**: read from the `User-Agent` the way `SNIFF.SPK` does
  (`Simxplorer 3.02`, `Voyager 1.1`, or the first word and version).
* **Time**, **page**, **title**, **referrer**, and the **machine's address**
  (`REQUEST.From`).

### Keeping it cheap

A hit appends one raw line and updates a few small files. A dashboard never
reads the raw lines. Everything is under `C:\STATDATA`, outside `C:\WEB`
(`C:\STATSDATA` would be one letter too long for 8.3):

| File | |
|---|---|
| `SITES.TXT` | `id\|owner\|name\|url\|public\|created\|on`, a line per site |
| `HOME.TXT` | the id of "this machine" |
| `USERS\<user>.TXT`, `SESSIONS\<id>.TXT` | accounts and sign-ins, as SimBook keeps them |
| `S\<id>\<yyyymmdd>.TXT` | the day's rollup: `kind\|key\|count` lines for hits, visitors, pages, titles, browsers, hours, referrers and machines |
| `S\<id>\<yyyymmdd>.LOG` | the day's raw hits, `time\|address\|visitor\|browser\|page\|title\|referrer` (then `.L2`, `.L3`... past 50K, so each file fits one network message) |
| `S\<id>\LIVE.TXT` | the last 20 hits |
| `S\<id>\TOTAL.TXT` | all-time hits, and since when |

A day's rollup keeps at most 200 pages and 200 referrers; past that they're
added up as `(other)`. The first hit of a day throws away raw logs older than
14 days and rollups older than 100. Hits to one site take turns: a lock
folder (`S\<id>\LOCK`), the way SimPal locks its ledger, so two at once
can't lose a count.

`TRACK.SPK` (the counting) doesn't touch `REQUEST`, `RESPONSE` or `SERVER`,
so `hit.asp` imports only it, and it also runs as a plain SPARK program: the
tests feed it 3,000 hits over 30 days that way.

## The pages

| Page | |
|---|---|
| `index.asp` | the front door; signed in, **My Sites** and **Add a Site** |
| `code.asp?s=ID` | the code to paste, for a page you name |
| `dash.asp?s=ID&r=1\|7\|30` | the dashboard, for the site's owner |
| `public.asp?s=ID` | the same for anybody, if the owner ticked **Public stats**; no addresses, no Visiting Machines |
| `live.asp?s=ID` | the last 20 hits; `&f=text` as plain lines; `&w=1` reloads itself |
| `edit.asp?s=ID` | name, address, public, counting on or paused, delete |
| `admin.asp` | the machine owner's overview |
| `optout.asp` | **Don't count me** |
| `privacy.htm` | what's kept, and for how long |
| `simstats.htm` | about SimStats |

The **dashboard** has the big numbers (hits, unique visitors, pages seen, all
time), hits and visitors by day as blue and orange bars, a histogram of the
hours, and Top 12 lists of pages (with titles), referrers, browsers (with
percentages) and visiting machines. The bars are table cells with a width and
a colour: 1997's chart library.

**Live** is a box of the last 20 hits, newest first. In Simxplorer its
JavaScript asks `live.asp?f=text` every 5 seconds with `XMLHttpRequest` and
fills the lines in, without reloading. Voyager runs no JavaScript and has no
`<meta>` refresh, so it gets a **Reload** link and **Watch live**
(`live.asp?w=1`), a small page whose SPARK page script waits 15 seconds and
navigates to itself (Simxplorer gets a `<meta>` refresh there instead).

One account can't see another's sites: every page that shows a site checks
that it's yours. Every form that changes something carries the session's form
token, as SimBook's do, so another site can't add, change or delete sites with
your cookie.

**The overview** (`admin.asp`) asks for the machine's own user name and
password (`C:\SYSTEM\USERS.INI`, like SimBook's reset page) every time. It
lists every site with its owner, hits today, in 7 and 30 days and all time,
and the totals.

## For visitors

**Don't count me** sets a cookie on the stats machine (`ssout=1`); `hit.asp`
then counts nothing for that browser on any site, though pages and counters
look the same. The privacy page says plainly what's kept: the time, the
machine's address, the browser, the page (and in Simxplorer its title and
referrer), and a random visitor number. Raw hits go after 14 days, daily
totals after 100. The site's owner sees addresses; the public page never
shows them.

## Moving in

SimHost's Move In copies `C:\STATDATA`. When the host has SimStats but no
accounts yet (only its own "this machine" site), the other machine's sites,
accounts and numbers are added: site ids are random, so they don't collide,
and `SITES.TXT` gains the other machine's lines. The other machine's own site
comes along as one more site that belongs to nobody; the host keeps its own
`HOME.TXT`. If the host already has SimStats accounts, Move In won't join two
sets (user names would collide), and says so.

## Tests

`node tools/aspsim/simstats.test.mjs`. They cover:

* the installer, at the root and in a SimHost folder;
* signing up, adding a site and the code to paste;
* hits from other machines over the network, through Voyager's requests
  (cookies and all) and a real Simxplorer window loading pages with the plain
  tag and the JavaScript tag;
* unique visitors, browsers, pages, titles, referrers, hours and machines on
  the dashboard;
* Live updating through `XMLHttpRequest` in Simxplorer;
* the counter's digits, opting out, public stats without addresses, paused
  sites;
* one account not seeing another's site, forms without the token, the
  owner's overview (and a wrong password);
* 3,000 hits over 30 days: every page under 64K and well inside the time
  limit, raw logs pruned;
* the SimHost front page counting itself, a GeoSimies homepage carrying the
  tag, and Move In.
