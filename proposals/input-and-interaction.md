# Proposal: input and interaction for SIM95 programs

*Draft, not sent yet.*

SIM95's controls are good at what they do by themselves. A program can't
yet shape *how people interact with them*:
* step in before a control acts on a key;
* follow the mouse anywhere but on a Canvas;
* see where something is scrolled;
* float something over a window.

So every new kind of interaction has to wait for the platform to build it.

This proposal is a handful of **general rules and primitives, the same for
every control**. With them, programs can build their own interactions:
suggestion lists, tooltips, drag and drop, spreadsheets, paint programs,
custom controls, games with a keyboard, and editors.

**Everything here is additive.** Programs that don't use it behave exactly
as now.

## What's there now

* **Keys:** every control has `onKey`, `Focus()`, `Focused` and `TabStop`,
  but:
  * a handler hears a key and can't stop it;
  * some keys never reach it: a text area keeps Enter and Tab, and Escape
    goes to the window;
  * a Canvas can't take the focus at all.
* **The mouse:** only a Canvas has mouse events (down, move, up). It has no
  wheel, double-click, enter or leave.
* **Focus:** no event says a control gained or lost the focus.
  * When a popup menu closes, whether an item was chosen or Escape was
    pressed, the focus goes nowhere: keys reach no window until the person
    clicks.
  * A menu closed with Escape fires no event, so a program can't put the
    focus back itself.
* **Scrolling:** text areas, lists, web views and consoles scroll, but a
  program can't read or set where any of them is scrolled.
* **The caret:** `SelStart` and `SelLength` can be read, but setting them
  doesn't move the caret.
* **Floating:** only menus and message boxes can appear over a window.
  * Controls overlap in the order they were made, with no way to change it.
  * A Canvas is always opaque.
* **Closing:** a window that is closing can't be kept open, so a program
  can't offer "Cancel" in "Save changes?".
* **The clipboard:** programs can't reach it.

## 1. Events can say "handled"

**The rule:** an event handler may return TRUE. That means "I've dealt with
it", and the control **doesn't** do its usual thing.

| Event | Its usual thing, which TRUE stops |
|---|---|
| `onKey` | typing the key, moving the caret, Tab to the next control, Enter pressing the default button |
| `onMouseDown`, `onMouseUp` | focusing, clicking, selecting |
| `onWheel` | scrolling |
| `onClose` | closing the window |
| `onPaste` | pasting |

**Keys go in a fixed order,** and each step can stop them:
1. the window first, if it asks (`Window.KeyPreview = TRUE`, as in VB);
2. then the focused control;
3. then the window's own `onKey`;
4. then the control's built-in behaviour.

Enter, Tab and Escape go through these steps like any other key.

## 2. The same mouse events on every control

```
onMouseDown(x, y, button)    onMouseUp(x, y, button)    onMouseMove(x, y)
onDblClick(x, y)             onWheel(delta, x, y)
onMouseEnter()               onMouseLeave()
```

* `x` and `y` are inside the control, so a program can tell which word of a
  label, which item of a list, or which cell of a grid was pointed at.
* **Capture:** after `onMouseDown`, the control keeps getting `onMouseMove`
  and `onMouseUp` until the button is released, even outside it. Drags then
  don't get lost at the edge.
* **`Cursor` property:** `default`, `pointer`, `text`, `move`, `resize-h`,
  `resize-v`, `wait` or `none`.

## 3. Focus

* **Any visible, enabled control can take the focus,** a Canvas included.
  `Focus()` works on all of them. A Canvas that has the focus gets every
  key through `onKey`.
* **New events:** `onGotFocus` and `onLostFocus`. Returning TRUE from
  `onLostFocus` keeps the focus, which is how forms check what was typed
  before moving on.
* **New property:** `Window.ActiveControl` names the control that has the
  focus.
* **When a popup menu closes,** the focus goes back to where it was before,
  as it does when a dialog closes. Menus also get an `onClose` event, so a
  program knows a popup was dismissed without a choice.

## 4. Scrolling, for everything that scrolls

On text areas, lists, web views, consoles and windows:

```
ScrollTop, ScrollLeft           read and set, in pixels
ScrollHeight, ScrollWidth       read-only: the size of all the content
onScroll()
```

* **Programs can read the view:** what's visible, what's under a point, and
  the screen position of any line.
* **Programs can set it:** keep two views in step, jump to a place,
  remember where someone was.

## 5. Text: the selection both ways

On text boxes and text areas:

* **Setting `SelStart` and `SelLength`** moves the caret and selection, and
  scrolls them into view.
* **`Select(start, length)`** does both in one call.

## 6. Layers, and things that float

* **Order:** `BringToFront()` and `SendToBack()` on controls and windows.
* **See-through canvases:** a Canvas with `Background = -1` is transparent.
  Laid over other controls, it draws highlights, guides, rubber-band
  selections and annotations.
* **Popup windows:** `GUI_Window.Style = "popup"`. A popup window:
  * has no title bar and doesn't appear on the taskbar;
  * floats over the window that made it, and moves and closes with it;
  * opens with `ShowNoActivate()`, so the focus stays where it was.

  A popup is the building block for tooltips, suggestion lists, custom
  drop-downs, colour pickers, notifications and floating tool palettes.

## 7. Where things are, and how big text is

* **Converting positions:** `ClientToScreen(x, y)` and `ScreenToClient(x, y)`
  on every control and window. They turn a point in one control into a
  point on the desktop or in another control, which is how something gets
  placed beside something else.
* **Measuring text:** `SYS.TextWidth(text, font, size)` and
  `SYS.TextHeight(font, size)`, for the fonts SIM95 draws with. Text on a
  canvas can then be centred, wrapped or fitted.

## 8. The clipboard

* **Writing:** `SYS.Clipboard = text` puts text on the real computer's
  clipboard.
* **Reading:** `onPaste(text)` fires on the focused control when the person
  pastes. This needs no browser permission, because the paste is their own
  act.
  * A text box pastes as it does now, unless the handler returns TRUE.
  * Any control can take a paste this way, a Canvas included.

## What these allow

| Program | Uses |
|---|---|
| Code editors: suggestions at the caret, Find and Replace, going to errors | 1, 4, 5, 6 |
| Spreadsheets and grids, drawn on a Canvas | 1, 2, 3, 4, 7, 8 |
| Paint and image editors: tools, zoom with the wheel, copy and paste | 2, 3, 6, 8 |
| Games played with the keyboard and mouse | 1, 2, 3 |
| Drag and drop: files between folders, items between lists | 2, 6, 7 |
| Tooltips and help that follows the mouse | 2, 6, 7 |
| Custom controls: tabs, tree views, sliders, a splitter between panes | 2, 3, 6 |
| Forms that check what was typed, and "Save changes?" with Cancel | 1, 3 |
| Maps, timelines and document viewers that pan and zoom | 2, 4 |
| Terminals and chat that scroll back, and stay at the bottom | 4 |
| Designers (Visual SPARK's form designer) | 1, 2, 3, 6 |
| Remote desktop and automation (with the handles proposal) | 1, 2, 3, 4 |

**Fits with the handles proposal:** its `SYS.Send(h, "Key", ...)` and
`"Click"` messages would go through the same steps as real keys and clicks.
So automation behaves exactly like a person, "handled" included.

## In stages

Each stage is useful by itself:

1. **"Handled", with Enter, Tab and Escape going through the steps; a
   Canvas that takes the focus; scrolling that can be read; the selection
   both ways.** All small changes to code that's already there:
   * the text area already tracks its scroll to keep its colouring lined
     up;
   * the key handlers already decide which keys to keep.
2. **Mouse events on every control, the focus events, and the wheel.**
3. **Popup windows, order, see-through canvases, converting positions.**
4. **Measuring text, the clipboard.**

## Appendix: the example that started this

Visual SPARK wants suggestions as you type, as VB has them:
* type `Command1.` and a list of its properties opens under the caret;
* typing more narrows it;
* Up, Down, Enter, Tab and Escape work the list.

In a test on sim95.kippy.io, a program could almost do it:
* the code editor's characters are 8px wide and 16px high, and it reports
  the caret's line and column;
* a menu can open anywhere as the list.

It needed three things from above: the scroll position (4), moving the caret
(5), and keeping keys from the editor while the list is open (1). After one
turn of the mouse wheel, the guessed position was 216px out.

The same test found a second gap. A Canvas can't take the keyboard, so the
form designer has to focus a 1-pixel button hidden under it to get the
Delete and arrow keys (3).
