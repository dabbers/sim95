# The npm registry

Where npm, which comes with [Node for SIM95](../node/), finds packages. It's a
web app on the central host: `http://starthere.56k.net/npm/`.

* **People** search it in Voyager or Simxplorer. Each package has a page with
  its README, versions, dependencies, and what uses it. Each person has a
  page of their packages.
* **npm** talks to it: `npm search`, `npm install`, `npm adduser`,
  `npm publish`.
* **Its first packages**, so `npm install` works on day one:

  | Package | What it is |
  |---|---|
  | `express` | Web servers the easy way: routes with `:params`, middleware, static files, JSON |
  | `lodash` | The utility belt: `chunk`, `uniq`, `groupBy`, `sortBy`, `debounce`, `camelCase`... |
  | `cowsay` | A cow says what you tell it; `npm install -g cowsay` for the command. Needs `wrap` |
  | `wrap` | Word-wrap text to a width |
  | `leftpad` | Pad a string on the left |
  | `minimist` | Parse command-line arguments |
  | `ms` | `ms('2 days')` and `ms(60000)` |
  | `uuid` | Random IDs |

  They're in `seed/`, one folder each, as their authors would have them.

## Installing

On STARTHERE: paste `INSTALL.SPK` into SPARK and press F5. It puts the pages
in `C:\WEB\NPM` and makes `C:\NPMDATA`, with the first packages, the first
time. Running it again upgrades the pages and leaves packages and accounts
alone. On any other machine it asks first, since a second registry would
split the packages. (npm on another network can be pointed at one with
`npm config set registry http://host/npm/`.)

It isn't in the Vapor stores, as there's only one registry. Because it's
listed on STARTHERE's front page, the Welcome Wagon tells newcomers about it.

## How it works

* **The pages:**
  * `INDEX.ASP` is the front page: the newest packages, search (`?q=`), and
    one person's packages (`?u=`).
  * `PKG.ASP?p=name[&v=version]` is a package's page. The README is shown
    with a little Markdown: headings, lists, code blocks and `code`.
  * `API.ASP?do=...` is what npm uses: `info`, `search`, `part`, `adduser`,
    `whoami`, `begin`, `put`, `finish` and `unpublish`. It answers in plain
    text, or JSON for `info` and `search`.
  * `REG.SPK` has what they share.
* **Packages travel in parts, as Vapor's installers do.**
  * `npm publish` puts every file of the package into one text bundle.
    Each file is a `@@F path` line, then its lines, each after a `|`.
  * It cuts the bundle into parts of whole lines, at most 30K each, so each
    fits in one network message. It sends them one at a time:
    * `begin` (with the README) gets a ticket;
    * `put` sends each part as it is, as the request's body;
    * `finish` checks every part arrived, and the total size, and files the
      version.
  * `npm install` fetches the parts with `part` and joins them. It checks the
    size and a sum before it unpacks anything.
* **Package names** are 1 to 8 of a-z, 0-9, `-` and `_`, as each is a folder:
  `NODE_MOD\EXPRESS` on the machines that install it, `C:\NPMDATA\P\EXPRESS`
  here. Versions are `1.2.3` or `1.2.3-beta.1`, and a published version can't
  be published again.
* **Accounts:** `npm adduser` makes one, or logs in to it. The registry keeps
  a salted sum of the password, never the password, and gives npm a token
  for publishing. Only a package's owner can publish or unpublish it. The
  first packages belong to `sim95`, an account nobody can log in to.
* **Everything is kept in `C:\NPMDATA`**, where the web server can't hand it
  out:
  * `USERS.TXT` and `PACKAGES.TXT`, a line each;
  * `P\<NAME>\` holds a package:
    * `VERSIONS.TXT`, with each version's parts, size, sum, date,
      publisher and dependencies;
    * a folder for each version (`V1`, `V2`...) holding its parts and
      README;
    * `DL.TXT`, the download count.
  * `UP\` holds publishes on their way. Ones not finished within an hour are
    cleared away.
  * Two publishes at once take turns, behind a lock folder, as the Pixel Wall
    does.

Tests: `node tools/aspsim/npm.test.mjs` installs the registry and Node and
covers:
* the pages;
* search, view and install, with dependencies, and `-g` commands;
* accounts, and publishing, also in several parts;
* new versions, `outdated` and `update`;
* two versions of one package in one project;
* an Express server.
