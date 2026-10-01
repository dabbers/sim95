# ColdMail

*Hot mail is so last year.*

Real e-mail between SIM95 machines: a mail server and a Yahoo!-style webmail.
Letters really cross the network. Your mail server hands them to the
recipient's mail server over port 25. Ones that can't be delivered come back
to you from MAILER-DAEMON.

## Install

1. In SIM95 open **Start > Programs > SPARK**, paste in the whole of
   [`INSTALL.SPK`](INSTALL.SPK), save it as `C:\MYFILES\INSTALL.SPK`, and press
   **F5**.
2. Open `http://YOURNAME/` in Voyager and sign up.

The installer makes the webmail this machine's home page: its pages go
into `C:\WEB`, and the stock `INDEX.HTM` moves aside to `WELCOME.HTM`. It puts
the mail server in
`C:\PROGRAMS\MAILD.SPK`. It starts the server and adds `C:\SYSTEM\STARTUP\MAIL.RUN`
so the server runs whenever the machine does. Running it again upgrades
ColdMail and restarts the server; mailboxes are kept. Each machine that should
receive mail needs ColdMail installed (or at least `MAILD.SPK` running).

Addresses are `name@machine`, using the machine's full name or just its
computer name: `bob@a3f9c2e1.dialup.zone` or `bob@a3f9c2e1`. A name with no
machine means this one.

## Mail programs: port 110

The server also listens on port 110 for mail programs such as
[Frostbird](../frostbird/). It speaks a small POP with one command and one
answer per message: `USER`, `PASS`, `LIST [SENT]`, `RETR n`, `DELE n`,
`SEND` and `QUIT`. Passwords are the webmail's, letters read there are read
here, and `SEND` spools a letter exactly as the webmail does. Upgrade
ColdMail on a machine (run its installer again) to switch this on.

## Hosting your own: GETMAIL.SPK

The front page (`/`) offers **Host ColdMail on your machine**
(`host.asp`). It hands out a small program, `GETMAIL.SPK`, with the machine
you got it from filled in. Paste it into SPARK on your machine and press F5.
It fetches ColdMail over the web one file at a time (the full installer is
too big for one 64K page), installs it, starts your mail server, adds it to
startup, and tells you to open `http://yourmachine/`.

Your machine also keeps the copies in `C:\WEB\DIST`, so the next person
can get ColdMail from you the same way. That's how shareware spread in 1996.
The installer writes those copies too: `DIST\<n>.TXT` plus a `MANIFEST.TXT`
of `n|where it goes`.

## How it works

```
 Voyager ──► C:\WEB\*.ASP ──► C:\MAILDATA\SPOOL\<n>.MSG
                                         │  every 2 seconds
                                         ▼
                        C:\PROGRAMS\MAILD.SPK ──port 25──► MAILD.SPK on their machine
                                         │                         │
                                         ▼                         ▼
                        C:\MAILDATA\BOX\<you>\      C:\MAILDATA\BOX\<them>\
```

Server pages can't open network connections. So, like Unix mail in 1996,
the webmail leaves outgoing letters in a spool folder, and the mail server
program delivers them. The server delivers to a mailbox on the same machine,
or connects to the other machine's server and speaks a small SMTP:

```
S: 220 BRAVO ColdMail ready
C: HELO ALPHA                     S: 250 Hello ALPHA, pleased to meet you
C: MAIL FROM:<ann@alpha>          S: 250 OK
C: RCPT TO:<bob@bravo>            S: 250 OK        (550 No such user here: bob)
C: DATA⏎<the whole letter>        S: 250 OK delivered
C: QUIT                           S: 221 Bye
```

Real SMTP sends `DATA` line by line, ending with a lone `.`; here a whole
letter is one network message, so it has to fit in 64K. Open **Monitor** to
watch it happen.

* **Unknown user (550)**: bounced straight back.
* **Machine not answering** (unknown host, refused, timed out): retried every
  30 seconds, 5 times, then bounced. `C:\MAILDATA\MAILD.INI` can set
  `retry=` seconds and `tries=`.
* **Server not running**: the webmail says so, and letters wait in the outbox.

The sending loop works around a SIM95 quirk. A wait that fails (a `Connect`
nobody answers, a `Receive` that times out) can be caught, but it spoils the
handler it happened in: the error comes back at that handler's next wait or
pause. So after a failed delivery the tick ends at once, and the next tick
records the retry or bounce. The whole tick sits in a `TRY` with an empty
`CATCH` and nothing after it. The receiving side also ignores replies to a
sender that has already hung up.

## Webmail

| Page | |
|---|---|
| `index.asp` | Sign in, sign up, or go host your own |
| `host.asp` | Hands out `GETMAIL.SPK`; sends you on to your own `/` |
| `inbox.asp?f=inbox\|sent` | A folder, newest first; unread letters in bold; tick and delete |
| `read.asp?f=&n=` | One letter; opening it marks it read. Reply, Forward, Delete |
| `compose.asp` | Write a letter (`?reply=N`, `?fwd=N` start from one, quoted) |
| `delete.asp`, `login.asp`, `join.asp`, `logout.asp` | Form handlers |

Letters are capped at 8,000 characters as you type (the box counts down).
Pages stop listing at 30K, and very long letters are cut short on screen,
because a page also has to fit in one 64K message. Every form carries a
per-session token, as in SimBook, so other sites can't send or delete mail in
your name.

## Storage

```
C:\MAILDATA\USERS\<user>.TXT      account: name, salt, pass
C:\MAILDATA\SESSIONS\<id>.TXT     sign-in cookie -> user, form token
C:\MAILDATA\BOX\<user>\<n>.MSG    one letter: headers, blank line, text
C:\MAILDATA\BOX\<user>\INBOX.TXT  n|date|from|to|subject|size|N(ew)
C:\MAILDATA\BOX\<user>\SENT.TXT   the same, for sent letters
C:\MAILDATA\SPOOL\<n>.MSG         X-Sender/X-Recipient/X-Tries/X-Next, blank line, letter
C:\MAILDATA\ALIVE.TXT             when the server last checked the spool
```

## Caveats

* It's 1996: nothing checks that `MAIL FROM` is true. The receiving server
  records the sending machine's real address in a `Received:` header, which
  is how you catch a forger.
* No spam filter, no quotas, no attachments.
* A desktop mail client (a Firebird-style program) would need a way to fetch
  mail, such as a POP3-like protocol on port 110 added to `MAILD.SPK`. Sending
  already works over port 25.

## Developing

```
node tools/build-installer.mjs coldmail   # regenerate INSTALL.SPK
node tools/aspsim/coldmail.test.mjs       # run the tests
```

The tests boot two machines on a pretend network (`tools/aspsim/network.mjs`).
They run the real SIM95 kernel, network stack and SPARK runtime, install
ColdMail on each by running `INSTALL.SPK`, and send mail between them.
