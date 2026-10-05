# SimBook

A tiny social network for [SIM95](https://sim95.kippy.io/), in the spirit of
the 2004 PHP-era thefacebook: accounts, profiles with a picture, friends,
Walls, a News Feed, thumbs up and down, replies, notifications and pokes. It is written entirely in SPARK as ActiveSparkPages
(`.ASP`) served by the machine's own `HTTPD.SPK`, and it installs as the
machine's home page.

## Install

1. In SIM95 open **Start > Programs > SPARK**.
2. Paste in the whole of [`INSTALL.SPK`](INSTALL.SPK), save it as
   `C:\MYFILES\INSTALL.SPK`, and press **F5**.
3. Open `http://YOURNAME/` in Voyager (from this machine or any other one on
   the network), and register.

The pages go straight into `C:\WEB`. `HTTPD.SPK` serves `INDEX.ASP` for a
folder only when there is no `INDEX.HTM`, so the installer moves the stock
home page aside to `C:\WEB\WELCOME.HTM` rather than deleting it. The samples
(`hello.asp` and the rest) keep working. Running the installer again upgrades
the pages without touching anyone's data.

## What it does

| Page | |
|---|---|
| `index.asp` | Front door: login and register |
| `home.asp` | News Feed: status box, plus posts by or to you and your friends |
| `profile.asp?u=name` | Picture, information, friends, and the Wall |
| `edit.asp` | Edit your profile |
| `picture.asp` | Choose your picture from the 20 stock ones |
| `view.asp?id=N` | One post with all its replies, and a reply box |
| `notify.asp` | Your notifications, new ones highlighted |
| `delete.asp?id=N[&r=R]` | "Delete this?", then deletes a post or a reply |
| `vote.asp`, `reply.asp`, `poke.asp` | Thumbs, replies and pokes; they redirect back |
| `people.asp?q=text` | Member directory and search |
| `post.asp`, `friend.asp`, `login.asp`, `join.asp`, `logout.asp` | Form handlers that redirect back |

* **Friends** are mutual and immediate: "Add to Friends" makes you both friends.
* **Walls**: only you and your friends can write on your Wall. Writing on your
  own Wall is your status update.
* **Feed**: the newest 25 posts written by or to you or a friend.
* **Thumbs and replies**: everyone whose feed a post reaches can give it a
  thumb up or down (click again to take it back) or reply. That means its
  author, the owner of its Wall, and their friends. The feed and Walls show
  the newest two replies; the post's own page shows the rest.
* **Deleting**: whoever wrote a post, or the owner of the Wall it is on, can
  delete it, along with its thumbs and replies. The same goes for
  replies. You are always asked first.
* **Notifications**: you get one when someone writes on your Wall, replies to
  your post or to one on your Wall, gives your post a thumb, pokes you, or
  adds you as a friend. The header shows how many are new. The newest 100 are
  kept.
* **Pokes**: poke a friend from their profile. Your home page lists who
  poked you, with "poke back" and "remove".
* **Counters**: every text box counts down as you type, and the button greys
  out while a box holds too much. This is a SPARK page script, which Voyager
  runs on every keystroke. The server checks the limits again anyway.

## Passwords

* **Change it:** Edit Profile > *Change my password* asks for the current one
  and then the new one twice. Your sign-ins elsewhere end; this one stays.
* **Forgot it? By e-mail:** put an e-mail address on your profile (only you
  see it). On the login page, *Forgot your password?* sends a link there.
  The link works once and for an hour, and asking again cancels the old one.
  The page gives the same answer whether or not the member has an address, so
  it can't be used to find out who does.
  * SimBook pages can't open connections, so the letter goes the way
    ColdMail's own do: into `C:\MAILDATA\SPOOL` for the mail server to
    deliver, from `simbook@<machine>`. That needs ColdMail on the same
    machine, which a [SimHost](../simhost/) machine has.
* **Forgot it? Ask the owner:** on the same page, whoever runs the machine
  can give any member a new password. It takes the machine's user name and
  password from `C:\SYSTEM\USERS.INI`, the same ones the Files service
  takes.

Every reset ends all of that member's sign-ins.

## Pictures: stock ones only

SimBook takes **no uploaded pictures or photos**, so nothing a stranger draws
is ever kept on the machine that runs it. Every member has one of 20 stock
pictures, `AV01.PIC` to `AV20.PIC` beside the pages (80 by 80): sixteen
little characters and four places (a beach, mountains, a sunset, a night).
A new member is given one at random; **Change My Picture** (`picture.asp`)
picks another. The choice is `avatar=N` in their profile, and a member from
before there were stock pictures has one their name picks.

The pictures are drawn by [`make-avatars.mjs`](make-avatars.mjs)
(`node simbook/make-avatars.mjs preview.png` also writes a contact sheet).

Upgrading an older SimBook deletes what was uploaded to it: each member's
`PICS\<user>.PIC`, every `PHOTOS\<post>.PIC` and the photo albums. Only
files that are plainly SimBook's go, so a home page's own pictures in a
folder of the same name stay. Posts that had a photo stay, as words, and old
links to an album lead to the member's profile.

## The 64K limit

SIM95 carries at most 65,536 characters in one network message. Voyager sends
a whole request as one message, and `HTTPD.SPK` sends a whole page as one.

On the server side, a page over 64K would stop the web server. So names,
profile fields and posts are capped, and the feed, Wall and directory stop
early. The tests fill everything with the worst content allowed (`<`, which
grows to `&lt;`), and the biggest page comes to about 40K.

## Forged requests (CSRF)

Voyager sends your SimBook cookie with every request to the server, including
one made by a form or link on somebody else's page. So the cookie alone can't
show that you meant to post, vote, unfriend or log out. Every session also has
a random 16-digit form token, kept on its second line in
`C:\BOOKDATA\SESSIONS`. Every SimBook form carries it as a hidden field `t`,
and every action link (thumbs, logout) as `&t=`. Every page that changes
something calls `RequireToken()` and sends anything without the right token
home untouched. Another site can't read SimBook's pages, so it can't learn the
token. Voyager sends no `Referer` header, so checking where a request came
from is not an option.

## Storage

There is no database and nothing is kept in memory. Every request reads the
plain text files it needs, and every change is written to disk at once. Data
lives in `C:\BOOKDATA`, outside `C:\WEB`, so the web server never hands it out:

```
C:\BOOKDATA\USERS\<user>.TXT    profile, key=value per line (password salted + hashed)
C:\BOOKDATA\FRIENDS\<user>.TXT  |ann|bob|cat|
C:\BOOKDATA\WALLS\<user>.TXT    posts on that user's Wall, one per line
C:\BOOKDATA\LOG\<n>.TXT         every post, 500 to a file by number (the feed reads the newest two)
C:\BOOKDATA\PEOPLE.TXT          user|name directory
C:\BOOKDATA\SESSIONS\<id>.TXT   sign-in cookie -> user, form token
C:\BOOKDATA\NEXTID.TXT          post counter
C:\BOOKDATA\VOTES\<post>.TXT    |ann+|bob-|
C:\BOOKDATA\REPLIES\<post>.TXT  number|date|author|name|text, one reply per line
C:\BOOKDATA\NOTES\<user>.TXT    notifications (.SEE: the last one read)
C:\BOOKDATA\POKES\<user>.TXT    |bob|cat|  who has poked them
C:\BOOKDATA\RESETS\<id>.TXT     an e-mailed reset link: user, when (TIME.Now), secret
C:\WEB\AV01.PIC ... AV20.PIC     the stock pictures
```

User names are 3–8 letters or digits, because they double as 8.3 file names.

Finding a post reads only its own log file, and writing one rewrites only
the newest file, so this stays quick however big SimBook gets. The installer
upgrades older data in place: it splits the first version's `POSTS.TXT` into
`LOG` files (keeping `POSTS.OLD`) and numbers old replies. See
[`MIGRATE.SPK`](MIGRATE.SPK).

## Caveats (it is a toy)

* SIM95 has no cryptography, so the password hash is home-made. It keeps
  passwords off the disk in plain text, and that is about all.
* There is no locking. Two requests at the same moment could race on a file.
  HTTPD handles one request at a time, so this is mostly theoretical.
* There are no friend requests.
* Login and registration have no form token, so another site could sign you
  in to an account of its choosing.

## Developing

Edit the files in `WEB`, then:

```
node tools/build-installer.mjs        # regenerate INSTALL.SPK
node tools/aspsim/simbook.test.mjs    # run the tests
```

The tests use `tools/aspsim`, a headless SIM95. It downloads the live bundle
from sim95.kippy.io and runs the real SPARK compiler, interpreter, disk and ASP
renderer in Node, so 8.3 names, compile errors and the page time limit all
behave as they do on the real machine. It also enforces the 64K message limit
on requests and pages. It runs a page's own SPARK script the way Voyager does,
so the tests can type into a box and watch the counter. Set `SIM95_REFRESH=1` to re-download.
