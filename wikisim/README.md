# WikiSim

*The encyclopedia on your computer.* WikiSim 96 is an encyclopedia for
[SIM95](https://sim95.kippy.io/) in the style of the 1996 CD-ROM ones
(Encarta, Grolier): 619 articles, a search box, A to Z, a random
article, an article of the day and "Did you know?". The articles are real:
they are Wikipedia's, cut back to what was known in 1996.

## Install

1. In SIM95 open **Start > Programs > SPARK**.
2. Paste in the whole of [`INSTALL.SPK`](INSTALL.SPK) (it is big, about
   410K; Vapor can also fetch it in parts), save it as
   `C:\MYFILES\INSTALL.SPK`, and press **F5**.
3. Open `http://YOURNAME/` in Voyager.

WikiSim becomes the machine's home page: its pages go in `C:\WEB`, and the
stock `INDEX.HTM` moves aside to `WELCOME.HTM`. On a [SimHost](../simhost/)
machine it goes in a folder instead, `http://YOURNAME/wiki/`, and leaves the
home page alone; SimHost also moves a WikiSim that was the home page into
`/wiki/`. The articles go in `C:\WIKIDATA` either way, outside `C:\WEB`.
Nothing writes there but the installer, so running it again just puts a
fresh copy there.

[ELIZA-95](../eliza/) on the same machine reads them too: "what is
music?" gets "According to WikiSim (1996 edition): ..." and the article's
address.

## The pages

| Page | |
|---|---|
| `index.asp` | The front page: search, A to Z, the Article of the Day and Did you know? (both the same all day, by the machine's date), and a few doors in |
| `article.asp?a=12` | One article, by number or by title, in any case (`a=music`; a short title finds a long one, so `a=doom` would find *Doom (1993 video game)*): the text with links to other articles, See also, the articles either side, and where the text came from |
| `search.asp?q=words` | Titles that start with what you typed, then titles with every word, then articles whose text has every word: 40 at most |
| `letter.asp?l=M&p=2` | Every title under a letter, 150 to a page (`l=0` for the ones that start with a digit) |
| `random.asp` | Off to any article |
| `wikisim.htm`, `license.htm` | About WikiSim (with keywords for AskSim), and the licence |

Every page stays well inside a server page's time limit: a lookup is one
`IndexOf` on a whole file, and the slowest search (a word that is nowhere)
reads every volume once. Every page fits in a 64K network message.

## The data

[`tools/make-wikisim.mjs`](../tools/make-wikisim.mjs) makes `DATA/`, and it
is checked in, so building the installer needs no network:

| File | |
|---|---|
| `INDEX.TXT` | `id|title|letter|volume`, A to Z. Ids follow the titles, so the articles either side are id-1 and id+1 |
| `VOL01.TXT`... | `id|title|text`, about 30K of whole articles to a file. In the text, `\` is a paragraph break and `{12|words}` a link to article 12 |
| `LINKS.TXT` | `id|id id id`: an article's See also, the articles that link to it |
| `DYK.TXT` | `id|sentence`: the Did you know? lines |

The articles are Wikipedia's [Vital Articles, Level 3](https://en.wikipedia.org/wiki/Wikipedia:Vital_articles/Level/3)
(about a thousand: the subjects every encyclopedia should have) and about
190 more, picked by hand, on period computing, the Internet and pop culture:
modems, BBSes, Netscape, Windows 95, DOOM, Myst, Tamagotchi, CompuServe,
Usenet, Gopher, *The X-Files*, *Friends*, Nirvana, *Toy Story* and so on.
Only the introduction of each is used.

**This edition is partial.** Wikipedia was throttling the address it was
built from, so the build stopped after 620 of the 1,187 titles (the first
three fifths of the Vital Articles: people, history, geography, the arts,
philosophy, religion, society) and was finished from the cache with
`--offline`. The rest of the Vital Articles and all the hand-picked extras
are still in the script: run `node tools/make-wikisim.mjs` again on a quieter
day, and it fetches only what it doesn't have.

The script asks Wikipedia's API gently: one request at a time, three
seconds apart, 20 intros to a request, backing off for longer and longer when
it is told to slow down, and keeping every answer in `tools/.wikicache` (not
checked in) so a rerun picks up where it left off. `--offline` rebuilds from
that cache alone.

### The 1996 cut

WikiSim is an encyclopedia of 1996, so the script cuts each introduction back:

* It splits the text into sentences. A sentence goes if it mentions a year
  from 1997 to 2099, "21st century" or "as of 20xx", or names something from
  after 1996: a list in the script (smartphone, social media, iPhone,
  Facebook, Google, YouTube, Wikipedia itself, COVID, Bitcoin, Brexit, the
  euro, Wi-Fi, DVD, the International Space Station...).
* Some sentences are mended rather than dropped. Somebody who died after 1996
  is "(born 18 July 1918)"; "from 1994 to 1999" becomes "from 1994"; and
  clauses come off the end of a sentence until what is left is from 1996
  (if enough is left).
* An article goes when its subject is from after 1996: the earliest year in
  its first sentence is after 1996, or the first sentence itself can't be
  kept. It also goes when less than 200 characters are left.
* "is currently" becomes "is at present". That is all the re-tensing there
  is: plenty of articles still say "is" about things that changed later, as
  any encyclopedia from 1996 would by now.
* What is left is cut, at the end of a sentence, to about 560 characters,
  so the whole encyclopedia fits in one installer.

One article was left out by the cut (Hong Kong, a special administrative region
only from 1997), 28 sentences were dropped, and others were mended; [`DROPPED.TXT`](DROPPED.TXT)
lists them and why. The test checks the result: no sentence in the data
names a year after 1996 or anything on the list.

Links are WikiSim's own. When another article's title turns up in the text
(or its short form: *Doom* for *Doom (1993 video game)*), that becomes a
link, the first time only and at most 12 to an article. See also lists the
articles that link to this one.

## Licence

The articles are from Wikipedia, the free encyclopedia, by its contributors,
and are used under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
**They have been changed:** shortened, cut back to 1996 as above, tidied, and
linked. Every article page says so and names the Wikipedia article it came
from; the details are in [`LICENSE.TXT`](LICENSE.TXT) and on the site's
`license.htm`. The changed articles are under CC BY-SA 4.0 too.

## Tests

`node tools/aspsim/wikisim.test.mjs`: the data (the 1996 cut, sizes, links),
installing, the front page, articles and their links, search hits and
misses, random, letter pages, the 64K limit on the biggest pages, the time
limit, ELIZA-95's answers, and WikiSim in a SimHost folder.
