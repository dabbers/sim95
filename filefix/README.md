# The Files fix: Copy and Paste anywhere

In SIM95's Files (`C:\PROGRAMS\FILES.SPK`), Copy in one window and Paste in
another does nothing, without a message. That's the usual way to copy a file
to another machine: the Network window's **Files** button opens a second
window for that machine's disk.

**Why:** each Files window is a program of its own, and keeps what was copied
in a variable. A second window has nothing copied, so its Paste quietly
returns. (Copying a folder also does nothing, without saying so.)

**The fix:**
* **Copy** keeps the file itself, its name and its contents, in
  `C:\SYSTEM\FILECLIP.TXT`, which every Files window shares. A file on another
  machine is read at Copy, so the window you paste in doesn't have to be logged
  on to that machine.
* **Paste** writes it into the folder the window is showing, on this disk or
  another machine's, and says so: "Pasted HELLO.TXT". With nothing copied it
  says "Nothing to paste".
* Copying a folder says that Copy works on files.

Like any file sent through the Files service, a file has to fit in one network
message, about 64K.

## Installing

From any Vapor store (under System), or paste `INSTALL.SPK` into SPARK and
press F5. The installer:
* changes only Copy and Paste in the machine's own `FILES.SPK`, and only if
  they are as SIM95 made them, leaving a changed Files alone;
* keeps the original as `C:\PROGRAMS\FILES.ORG`. To undo the fix, copy that
  back over `FILES.SPK`.

The fix is in `src/NEW.SPK`, and the two SUBs it replaces are in
`src/OLD.SPK`.

Tests: `node tools/aspsim/filefix.test.mjs` shows the bug first, then copies
between windows, and to another machine's disk and back.
