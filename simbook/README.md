# SimBook

A tiny social network for [SIM95](https://sim95.kippy.io/), in the spirit of
the 2004 PHP-era thefacebook: accounts, profiles with a picture, friends,
Walls, and a News Feed. It is written entirely in SPARK as ActiveSparkPages
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
| `picture.asp` | Upload or remove your picture (a `.PIC`, up to 100x100) |
| `people.asp?q=text` | Member directory and search |
| `post.asp`, `friend.asp`, `login.asp`, `join.asp`, `logout.asp` | Form handlers that redirect back |

* **Friends** are mutual and immediate: "Add to Friends" makes you both friends.
* **Walls**: only you and your friends can write on your Wall. Writing on your
  own Wall is your status update.
* **Feed**: the newest 25 posts written by or to you or a friend.

## Pictures and the 64K limit

SIM95 carries at most 65,536 characters in one network message. Voyager sends
a whole request as one message, and `HTTPD.SPK` sends a whole page as one.
Sketch always saves 400x300 pictures, about 120K, so Voyager refuses to send
one ("Message too long"). The picture page therefore hands out
[`SHRINK.SPK`](WEB/SHRINK.SPK), which a visitor runs on their own machine. It
turns `ME.PIC` into a 100x75 `AVATAR.PIC` of about 8K. Each 4x4 block becomes
the colour it holds most of, ignoring white, so thin lines survive.

On the server side, a page over 64K would stop the web server. So names,
profile fields and posts are capped, and the feed, Wall and directory stop
early. The tests fill everything with the worst content allowed (`<`, which
grows to `&lt;`), and the biggest page comes to about 40K.

## Storage

There is no database and nothing is kept in memory. Every request reads the
plain text files it needs, and every change is written to disk at once. Data
lives in `C:\BOOKDATA`, outside `C:\WEB`, so the web server never hands it out:

```
C:\BOOKDATA\USERS\<user>.TXT    profile, key=value per line (password salted + hashed)
C:\BOOKDATA\FRIENDS\<user>.TXT  |ann|bob|cat|
C:\BOOKDATA\WALLS\<user>.TXT    posts on that user's Wall, one per line
C:\BOOKDATA\POSTS.TXT           every post, append-only (the feed reads this)
C:\BOOKDATA\PEOPLE.TXT          user|name directory
C:\BOOKDATA\SESSIONS\<id>.TXT   sign-in cookie -> user
C:\BOOKDATA\NEXTID.TXT          post counter
C:\WEB\PICS\<user>.PIC          profile pictures
```

User names are 3–8 letters or digits, because they double as 8.3 file names.

## Caveats (it is a toy)

* SIM95 has no cryptography, so the password hash is home-made. It keeps
  passwords off the disk in plain text, and that is about all.
* There is no locking. Two requests at the same moment could race on a file.
  HTTPD handles one request at a time, so this is mostly theoretical.
* There is no CSRF protection, no post deletion, and no friend requests.

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
on requests and pages. Set `SIM95_REFRESH=1` to re-download.
