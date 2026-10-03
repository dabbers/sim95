# The Welcome Wagon

A greeter bot, and a link between every machine's chat room, for the
central host, STARTHERE.56k.net.

New people join the network, open Chat, and find an empty room. Chat
connects to their *own* machine's Chat service by default, and nobody else
is there. The Welcome Wagon is there. It waits in `#general` on every
machine as **StartHereBot** and says hello when somebody comes in:

```
*** StartHereBot joined #general
<StartHereBot> Hi newbie, welcome to SIM95! I'm the greeter bot from STARTHERE.
<StartHereBot> Open Voyager and go to http://starthere/ for AskSim, SimBook, ELIZA-95, GeoSimies, ColdMail, SimNIC and more.
<StartHereBot> This room is linked to #general on every machine: 2 people elsewhere on the network can talk with you here, and see what you say.
<StartHereBot> Say sites for the list, who for who's here, unlink to keep this room to this machine, or bye and I'll leave it alone.
*** regular joined #general
*** lateguy joined #general
<regular> hi newbie, welcome!
```

It also **links the rooms into one**. Everybody in `#general` on any
machine is in `#general` on every other machine where somebody is. Lines
read the same everywhere, under people's own names, and the list of who's
here is everybody on the network.

* **How it keeps up.** Machines join and leave the network all the time,
  and one that leaves says nothing: its connections just go quiet. So the
  bot doesn't wait to be told. It checks.
  * **Every 10 seconds it looks round the network** (`NET.Machines()`).
    * A new machine gets the bot in its `#general`, as `StartHereBot`.
      If that name is taken, it tries `StartHereBo2`, `StartHereBo3`... until
      one is free.
    * A machine missing from two looks in a row has gone. Its room, its
      people and their stand-ins everywhere go with it.
  * **Every look round, it asks each room who is there** (`WHO`) and
    believes the answer. Anybody it missed coming or going is put right
    then.
  * **Stand-ins are worked out four times a second** from what it knows:
    any that are missing are made, and any extra are closed.
  * **Timeouts:** a connection that hasn't got through in 12 seconds is
    given up and tried again. So is a room that has said nothing for three
    looks round.
  * **Clean disconnects:** it closes connections without `QUIT`. A plain
    close never sets off the stock Chat service's crash (see the notes).
* **Who it greets:** whoever is already in a room when it arrives, and
  anyone who comes in later.
* **What it advertises:** the same sites as STARTHERE's SimHost front page,
  read from the `APP.INF` in each app's folder, plus Vapor.
* **Once per person:** it greets each person once on each machine, ever.
  `C:\WELCOME\SEEN.TXT` remembers whom it has greeted, across restarts.
* **In a room:**
  * `sites` (or `help`, or `StartHereBot: sites`) lists every site with its
    address.
  * `who` says who is in the conversation, and on which machine.
  * `sites` and `who` answer at most once every 15 seconds in a room.
  * `bye` (or `go away`, `leave`) makes it say goodbye and leave that
    machine for good (`C:\WELCOME\OPTOUT.TXT`, by computer name).
* **How the linking works:**
  * Each person gets a *stand-in* in every other linked room that has
    somebody in it. A stand-in is a connection of the bot's own, under the
    person's exact name, which says what they say.
  * A room nobody is in gets no stand-ins, so the bot keeps few connections.
  * When somebody leaves, their stand-ins leave everywhere. When they
    `/nick`, their stand-ins take the new name.
  * The bot never repeats what a stand-in says, so nothing echoes.
  * Every room is linked by default. Each newcomer is told so in the
    greeting, and a room that was already busy is told once.
  * `unlink` keeps a room to its own machine (`C:\WELCOME\UNLINK.TXT`);
    `link` undoes it. STARTHERE's own room always stays linked.
  * **A name somebody in another room already has** can't be passed
    through: the Chat service won't have two of one name. Nothing is added
    to names, so that person isn't heard in that room. They're told once, in
    their own room ("Somebody on starthere is already called regular...").
    A `/nick` fixes it, and so does the other person leaving.
  * One person who reconnects to another machine's Chat under the same name
    may find their old stand-in still has it for a moment. Chat then says
    the name is in use, and `/nick` gets them in.
* **On STARTHERE's own `#general`,** where people are sent to meet:
  * It greets newcomers without the "come and chat here" line.
  * It doesn't greet the people who were already there when it started.
  * `bye` there does nothing.
* **Its window** logs what it does: machines found, rooms left, people
  greeted, rooms unlinked, names that clash. The status bar counts open
  rooms, the people in them, stand-ins and greetings.

## Installing it

On STARTHERE: paste `INSTALL.SPK` into SPARK and press F5. It writes
`C:\PROGRAMS\WELCOME.SPK`, starts it (stopping an older one), and adds
`C:\SYSTEM\STARTUP\WELCOME.RUN` so it starts with the machine.

On any other machine, the installer warns first: with two greeters, every
newcomer would be greeted twice. No Vapor store sells it, like SimNIC.

Settings, in `C:\WELCOME\WELCOME.INI`:

```
channel=#general
every=10
```

`every` is the number of seconds between looks round the network.

## Ordering

The stock Chat service can deliver lines out of order. The details are in
[SIM95-NOTES.md](../SIM95-NOTES.md#the-chat-service-found-for-the-welcome-wagon).
So the bot and its stand-ins:
* join only once their names are taken;
* send one line every half second on each connection, so a person's lines
  arrive in the order they were typed;
* greet and link people a moment and a half after they come in, by the
  name they have by then.

A room whose Chat service closes (the Disconnect crash in the notes) is
tried again after a second, then every 10 seconds. A machine whose Chat
service has never answered is tried every 5 minutes.

## How it's built

Everything is changed by one timer, the worker, four times a second. Three
other things only hand work to it, each with a single `Add`, so nothing is
changed by two at once:
* the network's events (a line came in, a connection closed);
* the dialler, which has up to four connections on their way at once, so
  one to a machine that has just gone can't hold the others up;
* the look round the network.

The worker deals with each thing it is handed inside its own `TRY`. A line
it can't make sense of is noted in the window ("Trouble with ..."), and
the bot carries on.

Tests: `node tools/aspsim/welcome.test.mjs`. They use real Chat services and
the real Chat program on a pretend network. They cover:
* a machine vanishing without a word;
* a burst of machines coming and going, after which every list must be
  exactly right and commands must still answer;
* a machine coming back under its old name;
* the bot's own name being taken.
