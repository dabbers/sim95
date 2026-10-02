# The Welcome Wagon

A greeter bot for the central host, STARTHERE.56k.net.

New people join the network, open Chat, and find an empty room. Chat
connects to their *own* machine's Chat service by default, and nobody else
is there. The Welcome Wagon is there. It waits in `#general` on every
machine as **StartHereBot** and says hello when somebody comes in:

```
*** StartHereBot joined #general
<StartHereBot> Hi newbie, welcome to SIM95! I'm the greeter bot from STARTHERE.
<StartHereBot> Open Voyager and go to http://starthere/ for AskSim, SimBook, ELIZA-95, GeoSimies, ColdMail, SimNIC and more.
<StartHereBot> Looking for people? We chat in #general on starthere: in Chat, put starthere in Server and press Connect.
<StartHereBot> Say sites for the list, or bye and I'll leave this machine alone.
```

* **How it finds people:**
  * It looks round the network every 30 seconds (`NET.Machines()`).
  * It joins `#general` on every machine whose Chat service answers.
  * It greets whoever is already in the room, and anyone who comes in later.
* **What it advertises:** the same sites as STARTHERE's SimHost front page,
  read from the `APP.INF` in each app's folder, plus Vapor.
* **Once per person:** it greets each person once on each machine, ever.
  `C:\WELCOME\SEEN.TXT` remembers whom it has greeted, across restarts.
* **In a room:**
  * `sites` (or `help`, or `StartHereBot: sites`) lists every site with its
    address, at most once every 20 seconds.
  * `bye` (or `go away`, `leave`) makes it say goodbye and leave that
    machine for good (`C:\WELCOME\OPTOUT.TXT`, by computer name).
* **On STARTHERE's own `#general`,** where people are sent to meet:
  * It greets newcomers without the "come and chat here" line.
  * It doesn't greet the people who were already there when it started.
  * `bye` there does nothing.
* **Its window** logs what it does: machines found, rooms left, people
  greeted. The status bar counts open rooms and greetings.

## Installing it

On STARTHERE: paste `INSTALL.SPK` into SPARK and press F5. It writes
`C:\PROGRAMS\WELCOME.SPK`, starts it (stopping an older one), and adds
`C:\SYSTEM\STARTUP\WELCOME.RUN` so it starts with the machine.

On any other machine, the installer warns first: with two greeters, every
newcomer would be greeted twice. No Vapor store sells it, like SimNIC.

Settings, in `C:\WELCOME\WELCOME.INI`:

```
channel=#general
every=30
```

`every` is the number of seconds between looks round the network.

## Ordering

The stock Chat service can deliver lines out of order. The details are in
[SIM95-NOTES.md](../SIM95-NOTES.md#the-chat-service-found-for-the-welcome-wagon).
So the bot:
* joins only once its name is taken;
* sends one line every half second;
* greets people a moment and a half after they come in, by the name they
  have by then.

Tests: `node tools/aspsim/welcome.test.mjs`. They use real Chat services and
the real Chat program on a pretend network.
