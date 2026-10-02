# AskSim

*Just ask Simms. He knows the network.*

An Ask Jeeves-style search engine for the SIM95 network, with a real crawler.
The crawler visits every machine it can see, reads their web pages over port
80, follows links (to other machines too), and builds an index. The search
pages answer plain-English questions from it.

## Install

1. In SIM95 open **Start > Programs > SPARK**, paste in the whole of
   [`INSTALL.SPK`](INSTALL.SPK), save it as `C:\MYFILES\INSTALL.SPK`, and press
   **F5**.
2. Open `http://YOURNAME/` in Voyager. The first crawl starts within a few
   seconds.

The installer makes AskSim this machine's home page: its pages go into
`C:\WEB`, and the stock `INDEX.HTM` moves aside to `WELCOME.HTM`. It puts the
crawler in
`C:\PROGRAMS\CRAWLER.SPK`, starts it, and adds `C:\SYSTEM\STARTUP\ASKSIM.RUN`.
The crawler goes round the network when it starts and every hour after. Its
window has a **Crawl Now** button and a log of what it found.

## The crawler

1. **Where to start**: every machine `NET.Machines()` can see (`http://name/`),
   sites people submitted on `addurl.asp`, and every page it already knows,
   to check they're still there. Pages it has never seen go first; known
   ones are checked again oldest first, so a crawl that runs out of room
   carries on from there next time, and pages it had no room for are left
   as they were (not marked gone).
2. **Fetching**: a plain `GET`, like Voyager's. At most 200 pages per machine
   and 1,000 in all per crawl. A SimHost machine with WikiSim's hundreds of
   articles is covered in a crawl or two.
   * **Sites decide what's left alone**: there are no built-in path rules.
     A site that wants something left out says so itself, with
     `/robots.txt` or `<meta name="robots">`.
   * **robots.txt**: it reads each machine's `/robots.txt` first and stays out
     of every path listed after `Disallow:`.
   * **Meta tags**: `<meta name="keywords">` words count three times (title
     words five), and `<meta name="description">` leads the result snippet.
     `<meta name="robots" content="noindex,nofollow">` is obeyed; AskSim's own
     results and cached copies say so, so it never indexes itself.
   * **Copies are kept once**: a page with the same text as one already kept
     from another machine (the SIM95 manuals in `/docs/`, which every machine
     serves) isn't indexed again. Each page's text fingerprint is in
     `DOCS.TXT`.
   * **Links it won't follow**: ones that look like they change something
     (logout, delete, vote, poke, anything carrying a form token `t=`),
     `localhost` links, and pictures and program files.
   * **One spelling per page**: `index.htm` and the folder itself count as the
     same page.
3. **Keeping**: for each page it saves the title, the text (scripts and tags
   stripped), and a **cached copy** with its links made absolute, so the copy
   still points at the real site.
4. **Pages that go away**: a known page that doesn't answer stays in the
   index, marked "not answering since" the first crawl that missed it, and the
   results offer its cached copy.
5. **Indexing**: one file per first letter, with lines like
   `chess|12:6 40:1`, meaning page 12 says "chess" six times and page 40 once.
   Title words count five times over.

## Searching

Type a question. Simms drops the question words ("where can I find
information about…") and looks up the rest. Ranking is tf-idf:

* a word counts for more the more often a page uses it, and for less the more
  pages it is on;
* a page with all your words beats one with some of them;
* a page that has stopped answering counts for half.

Each answer has a snippet with your words in bold, plus a **Cached** link.
There is also **site:machine** to keep to one machine, **Just take me to the
best answer** (`go=1`), follow-up questions to try, and **Add your site**.

## Storage

```
C:\ASKDATA\DOCS.TXT        id|url|title|crawled|ok or gone|since|fingerprint
C:\ASKDATA\TEXT\<id>.TXT   title, line break, page text (up to 12K)
C:\ASKDATA\CACHE\<id>.HTM  the page as last seen, links absolute (up to 40K)
C:\ASKDATA\IDX\<c>.TXT     word|id:count id:count ...   (0.TXT: words starting with a digit)
C:\ASKDATA\STATS.TXT       last crawl, pages, machines, seconds, TIME.Now
C:\ASKDATA\SEEDS.TXT       submitted sites
```

## A SIM95 quirk the crawler works around

In SIM95, a wait that fails can be caught with `TRY`: a `Connect` nobody
answers, or a `Receive` on a closed connection. But the handler it happened
in is then spoiled. The same error is raised again at its next wait, and also
at the pause the interpreter takes every 512 statements. (The kernel replaces
the task's generator with one that rethrows, and never puts it back.)

So the crawler is a state machine driven by its timer: each fetch starts in a
tick of its own, pages arrive through `onMessage`/`onClose` rather than
`Receive`, and the whole tick sits in a `TRY` with an empty `CATCH` and
nothing after it. A spoiled tick just ends. See the note at the top of
`CRAWLER.SPK`.

## Developing

```
node tools/build-installer.mjs asksim   # regenerate INSTALL.SPK
node tools/aspsim/asksim.test.mjs       # run the tests
```

The tests boot three machines on a pretend network, run the real `HTTPD.SPK`
on each, install AskSim on one, crawl, search, take a machine offline, and
crawl again.

## Domain names

The crawler follows links to sites by name (`http://www.fun.sim/`): it asks
the central name server (STARTHERE.56k.net, see [simweb](../simweb/)) where
each is, in a tick of its own, fetches from that machine with `Host:` saying
the name, keeps the pages under the name, and minds that site's own
`robots.txt`. The same site by path (`http://alpha/www.fun.sim/`, as simweb
serves it to Voyager) is crawled under its name instead, so it is never in
the index twice. With the name server down, names are machine names and the
crawl goes on. The builder joins the resolver onto `CRAWLER.SPK`.
