# Request: three small additions to `GUI_TextArea` (and two to `GUI_Canvas`)

*Draft, not sent yet.*

## Why

Visual SPARK, the VB-style IDE that runs on SIM95, needs **suggestions as you
type**, the way VB has them:
* type `Command1.` and a list of its properties opens right under the
  caret;
* typing more narrows the list;
* Up and Down move through it, Enter or Tab puts the choice in, and Escape
  closes it.

A program can almost do this today. The text area already reports `Line`
and `Column`. Its font is 16px SimMono, with characters 8px wide and lines
16px high, so the caret's place in the text is known exactly. Three things
are missing. The browser's `<textarea>` knows all three, but SPARK can't
get at them.

## 1. Where the text area is scrolled

```
TextArea.ScrollTop  AS Integer    read-only, in pixels
TextArea.ScrollLeft AS Integer    read-only, in pixels
```

* **The problem:** without these, a program has to guess the scroll from
  the caret's moves. One turn of the mouse wheel breaks the guess. In a test
  on sim95.kippy.io, after a wheel scroll and a click, a list meant for the
  caret opened 216px below it.
* **Where it goes:** the text area's `onScroll` handler already copies
  `scrollTop` and `scrollLeft` onto the colouring mirror. Writing them to
  `e.props` there is all that's needed. An `onScroll` event would be
  welcome too, but isn't required.
* **With this alone,** the caret's place on screen is exact:
  * x = `X + 3 + (Column - 1) * 8 - ScrollLeft`
  * y = `Y + 2 + (Line - 1) * 16 - ScrollTop`

## 2. Moving the caret

```
TextArea.SelStart  = n            move the caret (and scroll it into view)
TextArea.SelLength = n            select n characters from SelStart
TextArea.Select(start, length)    the same, in one call
```

* **The problem:** `SelStart` and `SelLength` can be set today, but nothing
  happens on screen; the caret only reports where it is. The only ways to
  move it are `GotoLine`, which selects a whole line and scrolls it to the
  middle, and `Insert`.
* **Where it goes:** `setSelectionRange` in the effect that already handles
  `gotoLine` and `insert`.
* **Who needs it:**
  * suggestions, to put the caret back after picking one;
  * Find and Replace;
  * Go to Line:Column;
  * jumping to the place a compile error names;
  * any editor that remembers where you were.

## 3. Keeping a key from the text area

```
SUB Ed_OnKey (key AS String) AS Bool    TRUE: the program has handled the key
```

* **The problem:** `onKey` hears a key but can't stop it. While a list is
  open, Down has to move the list, not the caret. Enter and Tab have to pick
  from it, not add a line or spaces. Escape has to close it.
* **Two gaps in today's handler:** Enter and Tab never reach `onKey`, and
  Escape skips it.
* **What's asked:**
  * when the handler returns TRUE, `preventDefault()` the key;
  * give Enter, Tab and Escape to `onKey` first, before the text area does
    its own thing with them.
* **Compatibility:** handlers that return nothing keep today's behaviour.

## And for `GUI_Canvas`: keys and the wheel

```
Canvas.onKey(key AS String)                 when the canvas has the focus
Canvas.onWheel(dy AS Integer, x, y)         the mouse wheel over the canvas
```

* **Keys:** a canvas can't take the keyboard. It has no `tabIndex`, and its
  mousedown calls `preventDefault`, so keys go to whatever had focus
  before. Visual SPARK's form designer has to focus a 1-pixel button hidden
  under its canvas to get Delete and the arrow keys. Games and drawing
  programs have the same problem.
* **The wheel:** a canvas never hears it, so anything drawn on a canvas
  that scrolls (a list, a map, a document) can't be scrolled with the
  mouse.

## Why not leave it to the programs?

The text area being the browser's own `<textarea>` is a good thing. It
brings, for free:
* typing in any language (IME);
* copy and paste with the rest of the computer;
* undo;
* the mouse wheel;
* selecting with the mouse;
* accessibility.

An editor drawn on a canvas would lose the wheel and the clipboard, since
programs can't reach either.

So these requests don't replace the native control. They let programs see
what it already knows (where it's scrolled), and steer it a little: put the
caret somewhere, keep a key.

## Each one is useful by itself

| Addition | What it allows |
|---|---|
| 1 | a suggestion list at the caret, worked by the mouse or with the list holding the keyboard |
| 1 + 2 | that, plus Find and Replace, and going to errors |
| 1 + 2 + 3 | suggestions as in VB: keep typing to narrow the list, Enter or Tab to pick |
| Canvas | designers, games and canvas-drawn views that take keys and scroll |
