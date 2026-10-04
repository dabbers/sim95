# Explorer

The file manager as Windows 95 has it: the folders in a tree on the left, what
is in one on the right, and the network in the same window. Another machine's
disk can be a drive letter, like Z:, under My Computer next to (C:), every
time Explorer starts.

```
C:\PROGRAMS\EXPLORER.SPK               My Computer
C:\PROGRAMS\EXPLORER.SPK C:\MYFILES    a folder        (\\BRAVO\ or Z:\ too)
C:\PROGRAMS\EXPLORER.SPK /folder Z:\   a folder window, without the tree
```

Its installer asks whether My Computer and My Files on the desktop should open
Explorer. If yes, `C:\PROGRAMS\FILES.SPK` becomes a small launcher for it, and
the Files that was there is kept as `FILES.BAK`. Network's Files button, and
Start > Find > Files, use it too. If Explorer is removed, the launcher puts
Files back the next time it runs.

## What's there

* **The tree:** Desktop, My Computer with (C:) and the mapped drives, Network
  Neighborhood with every machine on the network, and the Recycle Bin.
  * It has the dotted lines and + and − boxes; click one to open a folder.
  * Clicking a folder shows it, and the arrow keys walk the tree.
* **Four views:** Large Icons, Small Icons, List and Details (Name, Size,
  Type). Click a column head to sort by it.
* **Arranging:** by name, type or size, folders first.
* **Moving around:**
  * the toolbar's folder box;
  * the Address bar (`C:\DOCS`, `Z:\`, `\\BRAVO\`, `My Computer`);
  * Back, Forward and Up One Level;
  * Go To (Ctrl+G).
* **Mapped network drives:**
  * Tools > Map Network Drive picks a free letter and a path such as
    `\\BRAVO\MYFILES`, or `\\BRAVO\` for all of BRAVO's disk.
  * The toolbar has buttons for mapping and disconnecting, and right-clicking
    a machine in Network Neighborhood offers Map Network Drive.
  * Drives with **Reconnect at logon** are kept in `C:\SYSTEM\DRIVES.INI` and
    come back in every Explorer window. The others last until the last
    Explorer window closes.
  * A drive whose machine isn't there shows a red X, and says why.
* **Passwords:** the first visit to another machine asks for its user name
  and password, as **Enter Network Password**.
  * With **Save this password in your password list**, the next visit
    doesn't ask: it's kept in `C:\SYSTEM\PASSWORD.PWL`.
  * As in Windows 95, that list is no real secret: SIM95's passwords are
    plain text anyway.
* **Files:**
  * open them with a double click or Enter, and edit them (File > Edit);
  * New Folder and New Text Document;
  * Rename by typing over the name (F2);
  * Delete; Properties (Alt+Enter), with the size of a folder and what's in
    it.
* **Opening by kind:**
  * programs run;
  * `.PIC` opens in Sketch, `.HTM` in Voyager, `.JS` in Node (if it's
    installed), `.SH` in Sim Shell;
  * the rest open in Notes.
* **Cut, Copy and Paste** work between Explorer windows and between machines:
  * files, and whole folders with everything in them;
  * Paste into the folder something came from makes `NOTES~1.TXT`;
  * a name that's taken asks before it replaces anything.
* **Drag and drop** onto a folder, in the tree or in the files:
  * on the same disk it's a move; to another disk it's a copy, as Windows 95
    does it;
  * with the right button there's a menu: Move Here, Copy Here or Cancel;
  * onto the Recycle Bin it's a delete.
* **Choosing several:** drag a box around them, Shift with the arrow keys,
  Select All (Ctrl+A) or Invert Selection.
* **The Recycle Bin:**
  * Deleting from C: moves things to `C:\RECYCLED`, which keeps where each one
    came from.
  * You can Restore them, or Empty the Recycle Bin.
  * Shift+Delete deletes for good, as does anything on another machine's disk
    (Explorer says so first).
* **Undo** (Ctrl+Z) takes back the last rename, move, delete, copy or new
  folder.
* **Find** (F3): files by name (`*.TXT`, `NOTE?.*`, or part of a name),
  optionally holding some text, in a folder and the folders inside it. The
  results come up as Search Results.
* **Another machine's file opens in a copy here** (`C:\SYSTEM\TEMP`). When you
  save it in Notes, Explorer sends it back within a couple of seconds.
* **Right-click menus** on files, on the empty space, and on the tree.
* **Keys:**

  | Key | What it does |
  |---|---|
  | Tab | Switches between the tree and the files |
  | F2 | Rename |
  | F3 | Find |
  | F4 | The address bar |
  | F5 | Refresh |
  | Backspace | Up one level |
  | Alt+Left, Alt+Right | Back, Forward |
  | Delete, Shift+Delete | Delete (Shift: for good) |
  | Ctrl+X, Ctrl+C, Ctrl+V, Ctrl+Z | Cut, Copy, Paste, Undo |
  | A letter | Jumps to the next name starting with it |

* **Options:**
  * hide the extensions of known file types;
  * show names in capitals as they are stored, rather than as Windows 95
    shows them (`Notes.txt`).

  These, the view, and what's showing are kept in `C:\SYSTEM\EXPLORER.INI`.

## How it works

* **One program**, `C:\PROGRAMS\EXPLORER.SPK`, built from `src/`:
  * `MAIN.SPK`: the window, menus, toolbar and settings;
  * `VFS.SPK`: paths, the network, mapped drives and the Recycle Bin;
  * `VIEW.SPK`: drawing the tree and the files, and the mouse and keys;
  * `ACTIONS.SPK`: what the commands do, and the dialogs.

  `tools/build-installer.mjs` joins them and adds the pictures.
* **The pictures:** `src/ICONS.TXT` holds 16 by 16 icons in SIM95's own icon
  letters.
  * SIM95's built-in icons are copied there, so the folder, computer and
    network look as they do on the desktop.
  * The rest are drawn to match: the open folder, network drives, the Recycle
    Bin, file types and the toolbar's.
  * The builder makes each into Canvas pictures: 16 and 32 (doubled), plain,
    picked (dithered with navy, as Windows 95 does), and cut (faded). The
    toolbar's are plain or greyed.
* **The tree and the files are drawn on one Canvas**, with SIM95's 8 by 16
  font. That covers the lines, the boxes, the selection and the scroll bars.
  * A Canvas gets no keys, so a 1-pixel button under it takes them, as in
    Visual SPARK.
  * Double clicks are timed, since a Canvas reports only mouse down and up.
* **Other machines** are reached through their Files service (port 139,
  `AUTH`, `LIST`, `READ`, `WRITE`, `DEL`, `MKDIR`, `REN`, `STAT`), with one
  connection kept open to each.
  * **Connecting happens in a timer tick of its own:** a failed `Connect`
    spoils the handler it happens in (see `SIM95-NOTES.md`).
  * **Replies come in through `onMessage`**, waited for with `SYS.Sleep`,
    never with `Receive`.
  * So a machine that's off, or a drive whose machine has gone, gives a
    message and Explorer carries on.
* **The clipboard** (`C:\SYSTEM\EXPCLIP.TXT`) holds where things are, not the
  things: `copy` or `cut`, then a path on each line. Mapped drives are written
  as `\\MACHINE\...`, so every window understands them.

## Limits

* **64K per file over the network:** each Files service message carries one
  whole file. A bigger file can't be copied to or from another machine.
* **Names are 8.3,** as everywhere on SIM95. A name that won't do is refused,
  and says why.
* **No file dates:** SIM95 doesn't keep them, so Details has no Modified
  column.
* **Mapped drives are Explorer's.** Other programs, Sim Shell included, don't
  know Z: yet.
* **The mouse wheel and double-click events:** a Canvas has neither. See
  `proposals/input-and-interaction.md`.

Tests: `node tools/aspsim/explorer.test.mjs` sets up two machines and covers:
* installing, and taking Files' place;
* browsing, and passwords;
* mapping a drive and coming back to it;
* copying and moving between machines;
* drag and drop;
* the Recycle Bin and Undo;
* renaming, and remote edits saved back;
* a machine that isn't there;
* Network Neighborhood, Find and Disconnect.
