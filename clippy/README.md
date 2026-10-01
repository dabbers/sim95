# Clippy

Your SIM95 assistant: a paperclip with eyebrows who watches what you're doing
and offers to help, whether or not you wanted it.

## Installing

Paste `INSTALL.SPK` into SPARK, save it, and press F5. It writes
`C:\PROGRAMS\CLIPPY.SPK`, starts Clippy, and adds `C:\SYSTEM\STARTUP\CLIPPY.RUN`
so he's there every time the machine starts. (Ask him to go away and he'll
offer to stop that.)

## What he does

* **It looks like you're…** Every couple of seconds he looks at the programs
  running (`SYS.Tasks`) and has something to say about new ones:
  * Notes: "It looks like you're writing a letter. Would you like help?"
  * SPARK: "Would you like me to add some bugs, or would you rather find
    your own?"
  * Voyager and Simxplorer: offers to search the Web.
  * Frostbird: "there is no Unsend button".
  * Sketch: offers a stick figure.
  * Minesweeper: keeps watch for your boss.
  * Also Terminal, Chat, Files, and DOOM, should it appear.
* **He reads `C:\MYFILES`.** A text file that starts with "Dear" is a letter;
  he offers to mail it with Frostbird. A to-do list gets "Close Clippy" added,
  if you let him. He offers to run a new `.SPK`.
* **Every choice is a button**, including "Don't show me this tip again"
  (remembered in `C:\SYSTEM\CLIPPY.INI`). Now and then he offers a tip
  unasked.
* **Click him and ask a question.** He knows about installing apps, mail,
  the Web, the time, jokes, games and himself. Anything else goes to the Web:
  he opens Simxplorer (or Voyager) on an AskSim search.
* **He's drawn on a canvas:** a shiny wire clip on a sheet of paper, with
  eyes that blink and look around. His eyebrows go up when he has something
  to say, and he bounces for attention, frowns when thinking, and scribbles
  when "adding bugs". The yellow balloon above him grows to fit.

Tests: `node tools/aspsim/clippy.test.mjs`.
