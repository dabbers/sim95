# SimHost

One SIM95 machine for every web app, so you need one browser tab instead of
one per app.

A SIM95 machine has exactly one name on the network, and nothing can give it
another (see [SIM95-NOTES](../SIM95-NOTES.md)). So SimHost doesn't use names
to tell the apps apart. It gives each app a folder on the one machine:

| App      | Address              | Folder         |
|----------|----------------------|----------------|
| SimBook  | `http://HOST/book/`  | `C:\WEB\BOOK`  |
| ColdMail | `http://HOST/mail/`  | `C:\WEB\MAIL`  |
| AskSim   | `http://HOST/ask/`   | `C:\WEB\ASK`   |
| GeoSimies | `http://HOST/geo/` | `C:\WEB\GEO`  |
| WikiSim  | `http://HOST/wiki/`  | `C:\WEB\WIKI`  |
| ELIZA-95 | `http://HOST/eliza/` | `C:\WEB\ELIZA` |
| SimPal   | `http://HOST/pal/`   | `C:\WEB\PAL`   |
| SimTube  | `http://HOST/tube/`  | `C:\WEB\TUBE`  |
| SimStats | `http://HOST/stats/` | `C:\WEB\STATS` |
| SimNIC   | `http://HOST/nic/`   | `C:\WEB\NIC`   |
| Vapor    | `http://HOST/vapor/` | `C:\WEB\VAPOR` |

`http://HOST/` becomes a front page that lists them. Each web app's installer leaves an `APP.INF` (name, blurb, colour) in its folder, and the front page lists every folder that has one, so apps added later show up without reinstalling SimHost. Each app keeps its data
where it always has (`C:\BOOKDATA`, `C:\MAILDATA`, `C:\ASKDATA`,
`C:\GEODATA`, `C:\BOTDATA`, `C:\PALDATA`, `C:\TUBEDATA`, `C:\STATDATA`, `C:\WIKIDATA`), and each has its own cookie, so they don't get in each other's
way. The mail server and the crawler run side by side. With SimStats in
`/stats/`, the front page counts its own visitors: SimStats' installer makes a
site for the machine itself, and the front page carries its tag.

## Setting up

1. On the machine that will be the host, paste `INSTALL.SPK` into SPARK and
   press F5. It:
   * writes `C:\SYSTEM\WEBAPPS.INI` (`mode=folders`), the switch every
     installer looks at;
   * moves any web app that is already this machine's home page into its
     folder, along with its pictures and its `DIST` copy;
   * moves the stock `INDEX.HTM` aside to `WELCOME.HTM`;
   * writes the front page, `C:\WEB\INDEX.ASP`, and Move In,
     `C:\PROGRAMS\MOVEIN.SPK`.
2. Install the web apps, in any order, with their `INSTALL.SPK` files, from
   Vapor, or (ColdMail) with `GETMAIL.SPK` from another machine. Each one
   sees `WEBAPPS.INI`, goes into its folder, and leaves the home page alone.

If two apps were installed at the root, one after the other, the second wrote
over some of the first one's pages (`INDEX.ASP`, `LOGIN.ASP`...). SimHost
says which pages are missing. Install that app again to put them back. Its
data is not touched.

## Moving in: Move In

Run `C:\PROGRAMS\MOVEIN.SPK` on the host for each old machine:

1. Type the old machine's name, and its user name and password (the ones in
   its `C:\SYSTEM\USERS.INI`).
2. Tick what to bring over:
   * SimBook (its accounts and posts; uploaded pictures aren't moved, since
     SimBook keeps none now);
   * ColdMail accounts and letters;
   * the AskSim index;
   * ELIZA-95's conversations;
   * Vapor's games, saves and achievements;
   * Frostbird;
   * Simxplorer favorites;
   * GeoSimies homepages and guestbooks (their neighborhood folders too);
   * SimPal accounts and money;
   * SimTube movies, ratings and comments;
   * SimStats accounts, sites and statistics.
3. Press **Move In**.

It copies over the old machine's Files service (port 139, on by default),
and changes nothing there. When you're happy, close that machine's tab.

If the host already has some of the same data, Move In asks first, and then
only adds to it:

* Files that exist on both machines keep the host's copy.
* SimPal is never merged: two ledgers can't be added together without money
  appearing or vanishing, so if the host already has SimPal accounts, Move
  In skips it and says so. SimTube is the same: its movie numbers would
  collide. So is SimStats once the host has SimStats accounts (their names
  would collide); before that, the other machine's sites are added beside the
  host's own "this machine" site.
* Lists that can be joined line by line get the lines they're missing:
  favorites, Vapor's library and SimBook's member list.

Two things to know after moving:

* **Mail addresses** are `user@machine`, so ColdMail users on the host are
  now `user@HOST`. Letters sent to the old address need the old machine.
* **Frostbird** on other machines needs its server changed to the host.

## Everything else

* **Simxplorer** sets its search engine to `/ask/` and its Mail button to
  `/mail/` when it finds them in their folders.
* **Clippy** searches with the AskSim on the machine.
* **Domain names:** [simweb](../simweb/)'s Personal Web Manager gives the
  apps names of their own: *Domain Apps* makes `book.yourname.sim` SimBook,
  `mail.yourname.sim` ColdMail, and so on, or a site such as `coolbook.sim`
  can be SimBook. The names are registered, and pointed at this machine, at
  [SimNIC](../simnic/) on STARTHERE.56k.net. (SimNIC itself belongs on that
  one machine; on STARTHERE it is `/nic/` whether or not it is a SimHost
  machine.) Move In brings neither names nor `C:\WEB\VHOSTS.TXT` over: point
  the names at this machine at SimNIC, and add them here.
* **Vapor** installs web apps into their folders without asking to take the
  home page. **Open** goes to the app's folder, and **Uninstall** removes
  the files from there.

Tests: `node tools/aspsim/simhost.test.mjs`. They cover:

* moving apps that were installed at the root;
* every app in its folder;
* ColdMail and `GETMAIL` from `/mail/`;
* Simxplorer's settings;
* Move In from another machine;
* Vapor.
