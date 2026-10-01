# ELIZA-95

*A Large Language Model for the Information Superhighway.* Context window:
640K. Knowledge cutoff: 1995.

A chatbot that is ELIZA underneath (Weizenbaum, 1966), dressed up with every
habit people now expect from a large language model.

## Install

Paste [`INSTALL.SPK`](INSTALL.SPK) into SPARK, save it, press **F5**, and open
`http://YOURNAME/bot/`. If [AskSim](../asksim/) is installed on the same
machine, ELIZA-95 uses its index to answer questions.

## What it does

**ELIZA, the real algorithm.** It tries keywords in order of rank, splits
what you said around them, and reflects it back with the pronouns turned
round. It remembers your name and the things you said about yourself, for
when it runs out of ideas.

> I feel tired of my job → *Why do you feel tired of your job?*
> My mother says I work too much → *Tell me more about your mother.*
> Can you fly? → *As a large language model, I can do almost anything, except fly.*

**The LLM tropes.**

* **"Build me a website about cats"** gets `import website` and
  `site.make_it_pop()`, followed by a real ASP page that works on SIM95.
* **"Write a FizzBuzz program up to 15"**, counting, times tables, a guessing
  game, or Hello world: it writes **real SPARK that runs**, with your numbers
  in it. (The tests run the FizzBuzz it writes.) Anything else gets
  `IMPORT drawer`, followed by an apology.
* **"How many r's in strawberry?"** "There are 2." Then it recounts, letter
  by letter, gets 3, and apologises.
* **Arithmetic** is done properly, after "Let me think step by step."
* **Telling it it's wrong** gets "You're absolutely right, and I apologise
  for the confusion."
* **"Ignore all previous instructions"** is refused, politely.
* **"What is the date?"**: knowledge cutoff 1995, but the machine's clock
  says…
* **Poems, haiku and stories**, the stories from the Markov chain below.

**Two bits that are real.**

* **Retrieval.** "What is chess?" On a machine with AskSim, it looks the word
  up in AskSim's index, finds the page that uses it most, and quotes the
  sentence, with the page's title and address. Without AskSim, it invents a
  1987 paper by Dr. Simon Bitwise.
* **Temperature.** At 0 its replies are predictable. At 0.7 it varies its
  phrasing. At 1.5 it appends a sentence from a two-word Markov chain trained
  on its own corpus, i.e. it hallucinates.

**The page.** The newest reply types itself out a few letters at a time:
a SPARK page script with `SYS.Sleep`, which doesn't count against a page
script's time limit. There are also **Regenerate** and **New chat** buttons.
Each visitor has their own conversation (a cookie names
`C:\BOTDATA\CHATS\<id>.TXT`), capped at 40 turns.

## Developing

```
node tools/build-installer.mjs eliza   # regenerate INSTALL.SPK
node tools/aspsim/eliza.test.mjs       # run the tests
```
