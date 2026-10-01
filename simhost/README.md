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
| ELIZA-95 | `http://HOST/eliza/` | `C:\WEB\ELIZA` |
| Vapor    | `http://HOST/vapor/` | `C:\WEB\VAPOR` |

`http://HOST/` becomes a front page that lists them. Each app keeps its data
where it always has (`C:\BOOKDATA`, `C:\MAILDATA`, `C:\ASKDATA`,
`C:\BOTDATA`), and each has its own cookie, so they don't get in each other's
way. The mail server and the crawler run side by side.

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
   * SimBook, with its pictures and photos;
   * ColdMail accounts and letters;
   * the AskSim index;
   * ELIZA-95's conversations;
   * Vapor's games, saves and achievements;
   * Frostbird;
   * Simxplorer favorites.
3. Press **Move In**.

It copies over the old machine's Files service (port 139, on by default),
and changes nothing there. When you're happy, close that machine's tab.

If the host already has some of the same data, Move In asks first, and then
only adds to it:

* Files that exist on both machines keep the host's copy.
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
