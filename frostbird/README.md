# Frostbird

A desktop mail program for ColdMail, in the style of the mail programs of the
day. The window has three panes: folders on the left, the letters in the
folder at the top, and the letter you're reading below. The toolbar has drawn
buttons: Get Mail, Write, Reply, Forward, Delete and Settings.

## Installing

Paste `INSTALL.SPK` into SPARK, save it, and press F5. It writes
`C:\PROGRAMS\FROSTBRD.SPK` and starts it. Any machine can run Frostbird. Your
mail lives on the ColdMail server named in your address: `ann@alpha` means
the machine ALPHA. That server needs the current ColdMail, so run ColdMail's
installer there again to upgrade it.

The first time, Frostbird asks for your address and webmail password, and how
often to check for mail.

## What it does

* **Get Mail** (F5, and automatically every few minutes) signs in to your
  server on port 110 and brings down new letters, unread. When something
  arrives it beeps and puts the count in the title: `(2) Frostbird`.
* **Reading a letter** marks it read here and on the server, so the webmail
  agrees.
* **Write** (Ctrl+N), **Reply** (Ctrl+R) and **Forward** (Ctrl+L) open a
  window of their own. Replies quote the letter with `>`. Sending goes through
  your server, which delivers the letter and keeps a copy in Sent.
* **Delete** (the Delete key) removes the letter here and on the server.
  Letters deleted in the webmail disappear here at the next Get Mail.
* **Mark as Unread** (Ctrl+U), **Account Settings**, and a **Sent** folder.
* Simxplorer's **Mail** button opens Frostbird, and `mailto:` links open a new
  letter.

Letters are kept in `C:\FROST`: `INBOX.TXT` and `SENT.TXT` (one line per
letter) and `MAIL\<n>.MSG`. The password in `ACCOUNT.INI` is scrambled, which
keeps it from a glance and no more.

Tests: `node tools/aspsim/frostbird.test.mjs` runs two ColdMail servers and
Frostbird on a third machine.

## Domain names

The server is the part of the address after the `@`. For `ann@fun.sim`,
Frostbird asks the central name server (STARTHERE.56k.net, see
[simweb](../simweb/)) for fun.sim's MX record (the lowest preference), then
for the CNAMEs of that machine, a tick each, and collects from the machine it
names; with no answer, `fun.sim` is a machine name, as before. ColdMail on
that machine takes mail for fun.sim once its MX points there (see
[ColdMail](../coldmail/)). The builder joins the resolver onto
`FROSTBRD.SPK`.
