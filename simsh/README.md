# Sim Shell

*A proper command line for SIM95, at last.*

The stock Terminal runs one command per line and little else: no pipes, no
variables, no scripts. The **Sim Shell** (`SIMSH.SPK`) is a bash-like shell in
a window, with Unix paths, pipes and redirects, variables and aliases, `.SH`
scripts, history and Tab completion. It also talks to other machines: **ssh**
and **scp** over the network, and **sim-get**, an apt-style front end to the
[Vapor](../vapor/) store.

## Install

In SIM95 open **Start > Programs > SPARK**, paste in the whole of
[`INSTALL.SPK`](INSTALL.SPK), save it as `C:\MYFILES\INSTALL.SPK`, and press
**F5**. It writes:

* `C:\PROGRAMS\SIMSH.SPK`, the shell window;
* `C:\PROGRAMS\SSHD.SPK`, the remote-shell server, and starts it, adding
  `C:\SYSTEM\STARTUP\SSHD.RUN` so it runs whenever the machine does;
* `C:\SYSTEM\SIMSHRC.SH`, an example startup file, the first time only.

Both programs share one shell engine (`simsh/src/CORE.SPK`), so a command runs
the same whether you type it in the window or send it over ssh. The shell then
opens. Next time, start `C:\PROGRAMS\SIMSH.SPK` from Files.

It is also on the Vapor shelves: `sim-get install simsh`.

## The prompt

```
dab@alpha:C:\MYFILES$ ls -l
```

Up and Down walk the history; **Ctrl+Space** (or Tab) completes a file name;
**Ctrl+C** stops a running command or closes a remote session.

## Paths

Unix-style paths are mapped onto the C: drive, and DOS paths work too:

```
/programs/notes.spk   is   C:\PROGRAMS\NOTES.SPK
~                     is   C:\MYFILES  ($HOME)
..                    the parent;  cd -  the last directory
```

## Built-in commands

* **Files:** `ls` (`-l`), `cd`, `pwd`, `cat` (`-n`), `echo` (`-n`), `mkdir`
  (`-p`), `rm` (`-r -f`), `rmdir`, `mv`, `cp` (`-r`), `touch`, `head` (`-n`),
  `tail` (`-n`), `wc` (`-l -w -c`), `grep` (`-i -n -v -c`), `sort`, `uniq`,
  `tee`, `seq`, `basename`.
* **Environment:** `env`, `export NAME=value`, `set`, `unset`, `alias
  name='text'`, `unalias`.
* **Session and system:** `history` (`-c`), `clear`, `exit`, `ps`, `kill`
  (by pid or name), `run prog.spk` (or just type a program's name or a `.SPK`
  path), `date`, `whoami`, `hostname`, `uname`, `which`, `sleep`, `true`,
  `false`, `help`.
* **Network:** `ssh`, `scp`, `sim-get` (below).

## Shell syntax

```
cmd1 ; cmd2          one after another
cmd1 && cmd2         cmd2 only if cmd1 succeeded
cmd1 || cmd2         cmd2 only if cmd1 failed
cmd1 | cmd2          pipe text from one built-in to the next
cmd > file           write output to a file
cmd >> file          append
cmd < file           read input from a file
$VAR  ${VAR}  $?  $#  $0..$9     expansion ($? is the last exit status)
'single'  "double $VAR"          quoting
*  ?                             file-name wildcards
# comment
```

`NAME=value` on its own sets a variable for the rest of the session.

## Scripts

`sh script.sh` runs a shell script, and so does typing the path of a `.SH`
file. Arguments arrive as `$1`, `$2`, ... and `$#`. At startup the shell runs
`C:\SYSTEM\SIMSHRC.SH` (8.3!) if it is there — a good place for your aliases.

## ssh and scp — *not secure*

> **This is not SSH.** SIM95 has no cryptography. `ssh`/`sshd` here are *rsh
> with a password*: the user name, the password and everything you type travel
> as plain text that anyone running Monitor can read. The name is for fun. Do
> not pretend it is private.

Logging in uses the remote machine's one account — the user name and password
in its `C:\SYSTEM\USERS.INI`, the same ones the Files service takes. The server
(`SSHD.SPK`) listens on **port 22**.

```
ssh host                 open an interactive session (exit to return)
ssh user@host            ... as a particular account
ssh host command         run one command over there and print the result
scp file host:/path      copy a file to another machine   (Files service, 139)
scp host:/path file      ... and back
```

In an interactive session the prompt shows the remote machine; `cd`, `ls` and
the rest run over there. Output is cut to fit a 64K network message.

## sim-get — the Vapor store from the command line

`sim-get` is an apt-like front end to the same [Vapor](../vapor/) store, using
the same catalog, the same library (`C:\GAMES\LIBRARY.TXT`) and the same store
setting (`C:\GAMES\VAPOR.INI`). An app installed with `sim-get` shows up in
Vapor, and the other way round.

```
sim-get store alpha            point at a machine's store
sim-get update                 refresh the package lists
sim-get list [--upgradable|--installed]
sim-get search mail            find packages
sim-get show frostbrd          one package in detail
sim-get install frostbrd       download and install (games, programs, web apps)
sim-get upgrade                every installed package that has a newer build
sim-get remove frostbrd        uninstall (saved data is kept)
```

Progress reads the way apt does:

```
Get:1 http://alpha/vapor/ catalog.txt [742 B]
Reading package lists... Done
Get:1 http://alpha/vapor/ frostbrd 2 parts [7 kB]
Unpacking Frostbird (feedf00d) ...
Setting up Frostbird (feedf00d) ... running its installer
```

Web apps take over the home page, so `sim-get install` asks you to confirm with
`-y`, as Vapor asks with a dialog.

## How it works

`simsh/src/CORE.SPK` is the whole shell with no window and no socket: it parses
a line, runs it, and returns the text. `WINDOW.SPK` wraps it in the terminal
window and `NETJOB.SPK` adds ssh/scp/sim-get; `SSHD.SPK` wraps the same core as
a server. The installer builder (`tools/build-installer.mjs`) joins CORE with
each of them, so the two programs can never drift apart.

Network work is driven from a `GUI_Timer`, one job per tick, each inside the
tick's `TRY`/empty `CATCH` — a Connect to a machine that is not there is caught,
but it spoils the rest of its handler (see [`../SIM95-NOTES.md`](../SIM95-NOTES.md)),
so a job that fails can only end the tick.

## Tests

`node tools/aspsim/simsh.test.mjs` covers the built-ins, pipes, redirects,
variables, aliases and scripts through the headless core and through the GUI
window; ssh between two machines (a bad password refused, a remote command, an
interactive session); scp both ways; and sim-get against a Vapor store
(install, list, upgrade, remove), checking the library line matches Vapor's.

## Domain names

`ssh`, `scp` and `sim-get store <domain>` take names like `shell.fun.sim`:
before the job connects, the shell asks the central name server
(STARTHERE.56k.net, see [simweb](../simweb/)) which machine that is, in ticks
of its own, and `sim-get` sends `Host:` with the store's name. `host name
[type] [@server]` (or `nslookup`) asks the name server and prints what DIG
prints. The builder joins the resolver onto `SIMSH.SPK` (not `SSHD.SPK`,
which never connects anywhere).
