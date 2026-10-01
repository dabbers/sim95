# SimPal

*Your money is safe with us!!*

A late-90s PayPal for [SIM95](https://sim95.kippy.io/): accounts, sending and
requesting money, a history, and a **Pay with SimPal** button that any web
site on the network can put on its pages. The money is play money: SimBucks
(§). It is written in SPARK as ActiveSparkPages (`.ASP`) served by the
machine's own `HTTPD.SPK`, plus one helper, `PALCHECK.SPK`, for shops on the
same machine.

## Install

1. In SIM95 open **Start > Programs > SPARK**, paste in the whole of
   [`INSTALL.SPK`](INSTALL.SPK), save it as `C:\MYFILES\INSTALL.SPK`, and press
   **F5**.
2. Open `http://YOURNAME/` in Voyager and sign up. You get §100.00 to start.

On its own, SimPal becomes the machine's home page (the stock `INDEX.HTM`
moves aside to `WELCOME.HTM`). On a [SimHost](../simhost/) machine it goes in
`C:\WEB\PAL`, at `http://HOST/pal/`, and a SimPal that was the home page
moves there when SimHost arrives. Either way the installer also writes
`C:\PROGRAMS\PALCHECK.SPK`. Running it again upgrades SimPal; the accounts
and the ledger in `C:\PALDATA` are left alone.

## What it does

| Page | |
|---|---|
| `index.asp` | Front door: log in, or sign up (with the §100.00 welcome bonus) |
| `home.asp` | My Account: balance, requests to pay or decline, your own waiting requests, recent activity |
| `send.asp` | Send money to a member, with a note |
| `request.asp` | Ask a member for money; also takes the Pay, Decline and Cancel buttons |
| `history.asp` | Your newest 40 transactions, with receipt numbers for purchases |
| `pay.asp` | The checkout other sites send buyers to |
| `verify.asp?r=...` | A receipt's verdict as one line of plain text, for programs |
| `merchant.asp` | "SimPal for your web site": the button to paste, and how to check receipts |
| `simmart.asp` | SimMart, a demo shop selling a Genuine Y2K Bug (in a jar) for §4.99 |
| `admin.asp` | The bank manager: every account, the money supply, and Grant SimBucks |
| `simpal.htm` | About SimPal, for search engines |

* **Amounts** are typed like `5`, `12.50`, `§12.50` or `$1,000`. Inside,
  everything is whole cents in Integers: §12.50 is `1250`. There are no
  floats. Negative amounts, zero, three decimals, sending more than you have,
  sending to yourself, and anything over §10,000.00 at once are all refused.
* **Requests** wait on the payer's account page until they pay or decline.
  The one who asked can cancel. A request is paid once at most, and only by
  whoever it was made of, and only if they have the money.
* **Every form that moves money** carries the session's form token, as
  SimBook's do (`RequireToken`/`TokenField`). The cookie is `simpal`, so it
  doesn't clash with the other apps on a SimHost machine.

## The ledger: why money can't appear or vanish

Two page requests can run at the same time. While one waits (or every 512
statements), another runs, so two pages can both read "you have §100" and
both spend it. And a page can die halfway: it runs out of time, or the
machine is closed. SimPal guards against both.

```
C:\PALDATA\LEDGER\<n>.TXT     every transaction, 500 to a file: the books
C:\PALDATA\NEXTID.TXT         the last transaction number handed out
C:\PALDATA\APPLIED.TXT        every transaction up to this one is in the balances
C:\PALDATA\BAL\<user>.TXT     cents|last transaction applied to them
C:\PALDATA\HIST\<user>.TXT    |3|7|12|  their transactions
C:\PALDATA\USERS\<user>.TXT   profile (password salted + hashed)
C:\PALDATA\PEOPLE.TXT         user|name
C:\PALDATA\REQUESTS.TXT       number|date|asker|payer|cents|note|open/paid/declined/cancelled
C:\PALDATA\ORDERS\<user>.TXT  order|receipt: what a shop has been paid for
C:\PALDATA\USED\<n>.TXT       receipt n has been verified
C:\PALDATA\SESSIONS\<id>.TXT  cookie -> user, form token
C:\PALDATA\LOCK\              exists while a page is moving money
```

A transaction is one ledger line: `id|date|kind|from|to|cents|note|ref|order`.
The kind is `bonus` or `grant` (from `*`, the bank), `send`, `req` (a request
paid) or `pay` (a purchase; `ref` is its receipt).

Every page that moves money:

1. **Takes the lock.** The lock is a folder. `FS.MakeDir` fails if the folder
   exists, so checking and taking it is one step: no other page can get in
   between. Others wait (up to 3 seconds, then "SimPal is very busy", and
   nothing changes). A lock more than 10 seconds old was left by a page that
   died, and is cleared.
2. **Finishes what a dead page left.** Any ledger lines after `APPLIED.TXT`
   are applied now.
3. **Checks the payer has the money.** Then it writes the ledger line. That
   is a single `FS.Append`, so the line is either there or not.
4. **Applies it.** That means each side's balance and history, the shop's
   orders, and the request's status. Every step looks first and does nothing
   twice: a balance file records the last transaction applied to it.
5. **Writes `APPLIED.TXT`**, and lets go of the lock.

The ledger is the truth, and the balances are a cache of it. If a page dies
after step 3, its money has still moved: every balance read adds in the
ledger lines past `APPLIED.TXT` that the cache doesn't have yet. The next page
to take the lock makes the cache catch up. Only `bonus` and `grant` lines
make money. So all the balances together always come to every welcome bonus
plus every grant.

`admin.asp` checks exactly that. It adds the whole ledger up again from
scratch and puts what it says next to each account's balance. It shows the
money supply against bonuses plus grants, and says whether the books
**BALANCE**.

## Pay with SimPal

A shop is just a member: sign up under the shop's name. Then put a button on
any page, on any machine:

```html
<form action="http://PALHOST/pal/pay.asp" method="post">
<input type="hidden" name="to" value="myshop">
<input type="hidden" name="amount" value="4.99">
<input type="hidden" name="item" value="One widget">
<input type="hidden" name="order" value="ORDER17">
<input type="hidden" name="return" value="http://myshop/thanks.asp">
<input type="submit" value="Pay with SimPal">
</form>
```

(A link with the same fields works too. `merchant.asp` hands this out with
the right address filled in.)

1. The buyer logs in on SimPal (or signs up and comes straight back). They
   see the shop, item, order number and amount under the padlock, and press
   **Pay §4.99 Now**.
2. SimPal sends them back to `return` with `?receipt=R12-1A2B3C4D&order=ORDER17`
   added. Without a `return`, it shows the receipt itself.
3. The shop checks the receipt before it hands anything over:
   * **(a) A page on the same machine** imports the helper and asks:
     ```
     <%@ import file="C:\PROGRAMS\PALCHECK.SPK" %>
     <% IF VerifyReceipt(REQUEST.Query("receipt"), "myshop", "4.99", REQUEST.Query("order")) THEN %>
     ```
     It reads `C:\PALDATA` directly. `PalWhy` says why not (`unknown`,
     `merchant`, `amount`, `order`, `used`, `busy`). `ReceiptInfo(id)` looks
     without using it up, and `PalPayUrl()` says where `pay.asp` is.
     SimMart works like this.
   * **(b) A program anywhere** fetches `verify.asp?r=R12-1A2B3C4D` (optionally
     `&m=myshop&a=4.99&o=ORDER17`) and gets one line of `text/plain`:
     `VALID|merchant|amount|order|buyer|date`, `USED|...` (the same, but
     verified before), `INVALID|why` or `BUSY|try again`. A web page on
     another machine can't do this, because pages can't open connections. A
     SPARK program can. `merchant.asp` hands out `CHECKPAY.SPK`, which does it
     the safe way: it connects from a timer tick and reads with
     onMessage/onClose.

**A receipt verifies once.** The first VALID uses it up, and after that it is
USED, so coming back twice ships nothing twice. A check that doesn't match
(wrong amount, say) doesn't use it up. **An order is paid once.** SimPal won't
take a second payment for the same shop and order. A buyer who presses Pay
twice gets their first receipt back, and another buyer is refused.

## The trust model (it's a toy)

* **SimBucks are play money.** Don't build a real bank like this.
* **Whoever runs the SimPal machine is the bank.** They can print money
  (grants), and they can read or edit anything in `C:\PALDATA`, balances
  included. Everyone trusts them.
* **The button is plain HTML.** A buyer can change the price before paying.
  That is why the shop must check the amount (and merchant, and order) when it
  verifies. `VerifyReceipt` won't run without all three.
* **The trip back proves nothing.** Anybody can type `?receipt=` into the
  address bar; only a VALID answer counts.
* **A receipt is a password for one order.** It is a transaction number plus
  a random part, so it can't be guessed from another one. But the buyer knows
  it, and could use it up by checking it first. That only hurts them.
* **No encryption.** SIM95 has no SSL. Anyone running Monitor sees passwords,
  cookies and receipts go by. The padlock is text art.
* **Home-made hashing.** Passwords are salted and hashed with SimBook's
  hash. That keeps them off the disk in plain text, and that's all.
* **The lock is honest but simple.** If two pages both decide the same lock
  is stale at the same moment, they could both go ahead. That only happens
  after a page has died holding it. The ledger and the admin page's audit
  would show any damage.
* **Login has no form token**, as in SimBook, so another site could sign you
  in to an account of its choosing. It can't move money: that needs the token.
* **Refunds** are done by hand, with Send Money.

## Later: Buy with SimPal for Vapor games

Not built, and Vapor is not changed. The way it would go:

1. The store lists a price for a game, and a SimPal shop account for it.
2. **Buy** in Vapor opens `http://PALHOST/pal/pay.asp?to=store&amount=...&order=<machine>-<game>&return=...`
   in the browser. The order names the buying machine and the game, so each
   purchase is one order.
3. Vapor already fetches pages from the store from timer ticks. When the
   player presses **I've paid** and types the receipt, it fetches
   `verify.asp?r=...&m=store&a=...&o=<machine>-<game>` the same way. On
   `VALID`, it downloads the game and writes the receipt into its library line.
4. Vapor checks the receipt first, so a used one gives `USED` and the game
   isn't handed out again. A reinstall would look at the library line rather
   than ask SimPal.

## Developing

Edit the files in `WEB` and `PROGRAMS`, then:

```
node tools/build-installer.mjs simpal simhost   # SimHost knows where SimPal's files go
node tools/aspsim/simpal.test.mjs
```

The tests cover:

* signing up, sending, and requests paid, declined and cancelled;
* every kind of bad amount, the form token, and a page that dies
  mid-transfer;
* stale and live locks, racing pages, and the money supply over random
  transfers;
* the admin page;
* the whole Pay with SimPal round trip, through SimMart, verify.asp, a shop
  page using `VerifyReceipt`, and `CHECKPAY.SPK` running on another machine;
* folder mode under SimHost;
* the 64K page limit, with the worst text allowed (the biggest page is the
  account page, about 44K).
