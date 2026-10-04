# The Chat fix

SIM95's Chat service (`C:\PROGRAMS\CHATSVC.SPK`, port 6667) stops with an error
box, and that machine's chat is gone until it restarts:

```
Runtime error in Sock_OnMessage (line 157): Connection closed
```

(or line 112, or another line: any answer can do it).

**Why:**
* Chat's **Disconnect** sends `QUIT` and closes the connection at once.
* The service answers (`OK Bye`). When the close got there first, that
  `Send` throws "Connection closed", and nothing catches it, so the service
  stops.
* Any answer to someone who has just left does the same, for example
  "Nick in use", which a bot or the Chat program can trigger.
* `Broadcast` checked `IsOpen` first, but the answers to the one who asked
  didn't, and the connection can close between the check and the `Send`.

**The fix:** every line to a client goes through one SUB, `Tell`, which sends
it if the client is still there and lets a failure pass. Catching a failed
`Send` is safe: unlike a failed `Connect` or `Receive` (see `SIM95-NOTES.md`),
it doesn't spoil the rest of the handler.

## Installing

Paste `INSTALL.SPK` into SPARK on any machine and press F5. It's also in the
Vapor stores, under System.
* It replaces `CHATSVC.SPK` only if it's the one SIM95 made, and keeps that as
  `C:\PROGRAMS\CHATSVC.ORG` (copy it back to undo this).
* It restarts the service, so whoever is connected has to connect again.
* Worth doing first on STARTHERE, whose chat room the Welcome Wagon lives in.

`src/OLD.SPK` is SIM95's service, and `src/NEW.SPK` the fixed one.

Tests: `node tools/aspsim/chatfix.test.mjs`:
* makes the stock service crash with quick disconnects;
* installs the fix;
* sends 40 more quick disconnects, and checks that chat still works.
