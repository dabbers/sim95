// Builds each app's INSTALL.SPK: one SPARK program that writes every file of the
// app onto a SIM95 disk. Paste it into SPARK, save it, press F5.
//   node tools/build-installer.mjs            (all of them)
//   node tools/build-installer.mjs coldmail   (one)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lit = (s) => '"' + s.replace(/"/g, '""') + '"';
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

// Starts a program now (stopping a copy that is already running, so an upgrade
// takes effect) and makes it start whenever the machine does.
const startService = `
SUB StartService (name AS String, program AS String, runFile AS String)
    VAR task AS String
    FS.Write("C:\\SYSTEM\\STARTUP\\" + runFile, program)
    Print("  " + name + " will start with the machine (C:\\SYSTEM\\STARTUP\\" + runFile + ")")
    FOR EACH task IN SYS.Tasks()
        IF task.Split("|")[1].Upper() = name THEN
            SYS.Kill(Int(Val(task.Split("|")[0])))
            Print("  stopped the old " + name)
        END IF
    NEXT
    SYS.Run(program)
    Print("  started " + program)
END SUB
`;

const moveHomePage = `
' HTTPD.SPK serves INDEX.ASP for a folder only when it has no INDEX.HTM, so the
' stock home page steps aside (to the first free name) instead of being deleted.
SUB MoveHomePage ()
    VAR names AS Array OF String
    VAR name AS String
    IF NOT FS.Exists("C:\\WEB\\INDEX.HTM") THEN RETURN
    names = ["WELCOME.HTM", "INDEX1.HTM", "INDEX2.HTM", "INDEX3.HTM", "INDEX4.HTM", "INDEX5.HTM", "INDEX6.HTM", "INDEX7.HTM", "INDEX8.HTM", "INDEX9.HTM"]
    FOR EACH name IN names
        IF NOT FS.Exists("C:\\WEB\\" + name) THEN
            FS.Rename("C:\\WEB\\INDEX.HTM", "C:\\WEB\\" + name)
            Print("  moved the old home page to C:\\WEB\\" + name)
            RETURN
        END IF
    NEXT
    THROW "C:\\WEB\\INDEX.HTM is in the way and there is nowhere to move it. Rename it yourself and run this again."
END SUB
`;

// The Vapor store's games. Each is cut into parts of at most PART characters
// (a whole line at a time), so every part fits in one network message.
const vaporGames = [
  { id: "SIMDOOM", name: "SimDOOM", genre: "Shooter", about: "Rip and tear through E1M1 in glorious 16 colours. A real raycast 3D view, imps that chase you, a pistol, health and ammo, a face that watches you, and achievements. Type IDDQD at your own risk." },
  { id: "SNAKE", name: "Snake 95", genre: "Arcade", about: "Eat the dots. Grow longer. Don't eat yourself. The game that sold a million phones, now on SIM95." },
  { id: "HL3", name: "Half-Life 3", genre: "Shooter", soon: true, about: "The long-awaited conclusion. Coming soon." },
];
const PART = 15000;
function cut(text) {
  const parts = [];
  let cur = "";
  const lines = text.replace(/\r/g, "").split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  for (const line of lines) {
    if (cur.length + line.length + 1 > PART && cur) { parts.push(cur); cur = ""; }
    cur += line + "\n";
  }
  if (cur) parts.push(cur);
  return parts;
}
// Every installer, game and the Vapor program itself starts with a header line
// that says what it is, so a Vapor store can publish it (Vapor's Publish Apps
// reads the same line):
//   ' VAPOR|id=SIMXPLOR|name=Simxplorer|kind=program|version=1a2b3c4d|...
// kind is program, service, web, game or client (Vapor itself). version is a
// hash of the rest of the file, so every change makes a new version.
const version = (text) => crypto.createHash("sha1").update(text).digest("hex").slice(0, 8);
function header(meta) {
  const clean = (v) => String(v ?? "").replace(/[|\r\n]/g, " ");
  return "' VAPOR|" + ["id", "name", "kind", "version", "category", "run", "files", "tasks", "startup", "about"].map((k) => k + "=" + clean(meta[k])).join("|");
}
// A catalog line for a file with a header:
//   id|name|parts|bytes|status|category|about|kind|version|run|files|tasks|startup
function catalogLine(text, parts) {
  const m = Object.fromEntries(text.split("\n")[0].slice("' VAPOR|".length).split("|").map((kv) => [kv.slice(0, kv.indexOf("=")), kv.slice(kv.indexOf("=") + 1)]));
  return [m.id, m.name, parts, text.length, "ok", m.category, m.about, m.kind, m.version, m.run, m.files, m.tasks, m.startup].join("|");
}
const withHeader = (meta, body) => header({ ...meta, version: version(body) }) + "\n" + body;
const vaporClient = () => withHeader({ id: "VAPOR", name: "Vapor", kind: "client", category: "Vapor", run: "C:\\PROGRAMS\\VAPOR.SPK", files: "C:\\PROGRAMS\\VAPOR.SPK", tasks: "VAPOR", about: "The Vapor program itself." }, read("vapor/PROGRAMS/VAPOR.SPK"));
const gameText = (g) => withHeader({ id: g.id, name: g.name, kind: "game", category: g.genre, run: `C:\\GAMES\\${g.id}\\${g.id}.SPK`, files: `C:\\GAMES\\${g.id}\\${g.id}.SPK`, tasks: g.id, about: g.about }, read(`vapor/GAMES/${g.id}.SPK`));
function vaporStore() {
  const files = [];
  const catalog = [];
  for (const g of vaporGames) {
    if (g.soon) { catalog.push([g.id, g.name, 0, 0, "soon", g.genre, g.about, "game", "", "", "", "", ""].join("|")); continue; }
    const text = gameText(g);
    const parts = cut(text);
    parts.forEach((p, i) => files.push({ dest: `C:\\WEB\\VAPOR\\${g.id}\\${i + 1}.TXT`, text: () => p }));
    catalog.push(catalogLine(text, parts.length));
  }
  const client = vaporClient();
  const parts = cut(client);
  parts.forEach((p, i) => files.push({ dest: `C:\\WEB\\VAPOR\\VAPOR\\${i + 1}.TXT`, text: () => p }));
  catalog.push(catalogLine(client, parts.length));
  files.push({ dest: "C:\\WEB\\VAPOR\\CATALOG.TXT", text: () => catalog.join("\n") + "\n" });
  files.push({ dest: "C:\\PROGRAMS\\VAPOR.SPK", text: () => client });
  return files;
}

const apps = {
  simbook: {
    vapor: { id: "SIMBOOK", name: "SimBook", kind: "web", category: "Social", run: "/", tasks: "", startup: "", about: "The social network for the SIM95 network: profiles, friends, a news feed, walls, photos and pokes. Becomes this machine's home page." },
    title: "SimBook",
    about: `' Save this as C:\\MYFILES\\INSTALL.SPK in SPARK and press F5. SimBook becomes
' this machine's home page: its pages go into C:\\WEB, and the stock INDEX.HTM is
' moved aside to WELCOME.HTM, so the web server falls back to INDEX.ASP. It
' leaves C:\\BOOKDATA (accounts, posts) alone, so running it again upgrades
' SimBook without losing anybody. Then open http://YOURNAME/ in Voyager.`,
    copy: [["simbook/WEB", "C:\\WEB"]],
    dirs: ["C:\\WEB\\PICS"],
    first: ["MoveHomePage()", "Migrate()"],
    last: [],
    url: "/",
    code: () => moveHomePage + "\n" + read("simbook/MIGRATE.SPK"),
  },
  coldmail: {
    vapor: { id: "COLDMAIL", name: "ColdMail", kind: "web", category: "Internet", run: "/", tasks: "MAILD", startup: "MAIL.RUN", about: "Free webmail and a real mail server: send letters to anybody on any machine. Becomes this machine's home page." },
    title: "ColdMail",
    about: `' Save this as C:\\MYFILES\\INSTALL.SPK in SPARK and press F5. It puts the
' webmail in C:\\WEB as this machine's home page (the stock INDEX.HTM moves to
' WELCOME.HTM) and the mail server in C:\\PROGRAMS\\MAILD.SPK, starts
' the server, and adds it to C:\\SYSTEM\\STARTUP so it runs whenever the machine
' does. Mailboxes in C:\\MAILDATA are left alone, so running it again upgrades
' ColdMail without losing any mail. Then open http://YOURNAME/ in Voyager.`,
    copy: [["coldmail/WEB", "C:\\WEB"], ["coldmail/PROGRAMS", "C:\\PROGRAMS"]],
    dirs: [],
    // Numbered copies of every file, served as plain text, for GETMAIL.SPK
    // (see coldmail/WEB/MAIL/GETMAIL.TXT) to fetch one at a time.
    dist: "C:\\WEB\\DIST",
    first: ["MoveHomePage()"],
    last: [`StartService("MAILD", "C:\\PROGRAMS\\MAILD.SPK", "MAIL.RUN")`],
    url: "/",
    code: () => startService + moveHomePage,
  },
  asksim: {
    vapor: { id: "ASKSIM", name: "AskSim", kind: "web", category: "Internet", run: "/", tasks: "CRAWLER", startup: "ASKSIM.RUN", about: "A search engine with a real crawler that goes round every machine on the network. Becomes this machine's home page." },
    title: "AskSim",
    about: `' Save this as C:\\MYFILES\\INSTALL.SPK in SPARK and press F5. It puts the
' search pages in C:\\WEB as this machine's home page (the stock INDEX.HTM moves
' to WELCOME.HTM) and the crawler in C:\\PROGRAMS\\CRAWLER.SPK, starts
' the crawler (it goes round the network straight away, then every hour), and
' adds it to C:\\SYSTEM\\STARTUP. The index in C:\\ASKDATA is kept, so running
' this again upgrades AskSim. Then open http://YOURNAME/ in Voyager.`,
    copy: [["asksim/WEB", "C:\\WEB"], ["asksim/PROGRAMS", "C:\\PROGRAMS"]],
    dirs: [],
    first: ["MoveHomePage()"],
    last: [`StartService("CRAWLER", "C:\\PROGRAMS\\CRAWLER.SPK", "ASKSIM.RUN")`],
    url: "/",
    code: () => startService + moveHomePage,
  },
  simxplorer: {
    vapor: { id: "SIMXPLOR", name: "Simxplorer", kind: "program", category: "Internet", run: "C:\\PROGRAMS\\SIMXPLOR.SPK", tasks: "SIMXPLOR", startup: "", about: "A web browser with JavaScript, favorites, history, find on page and AutoSearch." },
    title: "Simxplorer",
    about: `' Save this as C:\\MYFILES\\INSTALL.SPK in SPARK and press F5. It writes
' Simxplorer to C:\\PROGRAMS\\SIMXPLOR.SPK: the browser window and its
' JavaScript engine in one program. Start it from Files (double-click it) or
' from SPARK. Your Voyager bookmarks become its Favorites the first time, and
' the two share cookies (C:\\SYSTEM\\COOKIES.TXT). Settings are kept in
' C:\\SYSTEM\\SIMXPLOR.INI.`,
    copy: [],
    // the engine and the window, joined into one program
    generated: [{ dest: "C:\\PROGRAMS\\SIMXPLOR.SPK", text: () => read("simxplorer/src/JSCRIPT.SPK") + "\n" + read("simxplorer/src/BROWSER.SPK") }],
    dirs: [],
    first: [],
    last: [`SYS.Start("C:\\PROGRAMS\\SIMXPLOR.SPK", "")`],
    done: `Print("Simxplorer is running. Next time, start C:\\PROGRAMS\\SIMXPLOR.SPK from Files.")`,
    code: () => "",
  },
  frostbird: {
    vapor: { id: "FROSTBRD", name: "Frostbird", kind: "program", category: "Internet", run: "C:\\PROGRAMS\\FROSTBRD.SPK", tasks: "FROSTBRD", startup: "", about: "A desktop mail program for ColdMail: Get Mail, Write, Reply, Forward." },
    title: "Frostbird",
    about: `' Save this as C:\\MYFILES\\INSTALL.SPK in SPARK and press F5. It writes
' Frostbird, a mail program for ColdMail, to C:\\PROGRAMS\\FROSTBRD.SPK and
' starts it. Any machine can have it: it collects your mail from the ColdMail
' server named in your address (ann@alpha: the machine ALPHA), which needs
' ColdMail's newer MAILD.SPK (the one that listens on port 110 too). Letters
' are kept in C:\\FROST. Simxplorer's Mail button opens it.`,
    copy: [["frostbird/PROGRAMS", "C:\\PROGRAMS"]],
    dirs: [],
    first: [],
    last: [`SYS.Start("C:\\PROGRAMS\\FROSTBRD.SPK", "")`],
    done: `Print("Frostbird is running. Next time, start C:\\PROGRAMS\\FROSTBRD.SPK from Files.")`,
    code: () => "",
  },
  clippy: {
    vapor: { id: "CLIPPY", name: "Clippy", kind: "service", category: "Productivity", run: "C:\\PROGRAMS\\CLIPPY.SPK", tasks: "CLIPPY", startup: "CLIPPY.RUN", about: "Your SIM95 assistant. It looks like you're reading a description! Would you like help?" },
    title: "Clippy",
    about: `' Save this as C:\\MYFILES\\INSTALL.SPK in SPARK and press F5. It writes
' Clippy, your SIM95 assistant, to C:\\PROGRAMS\\CLIPPY.SPK, starts him, and
' adds him to C:\\SYSTEM\\STARTUP so he is there whenever the machine starts.
' He can be told to stop that (ask him to go away). His settings are in
' C:\\SYSTEM\\CLIPPY.INI.`,
    copy: [["clippy/PROGRAMS", "C:\\PROGRAMS"]],
    dirs: [],
    first: [],
    last: [`StartService("CLIPPY", "C:\\PROGRAMS\\CLIPPY.SPK", "CLIPPY.RUN")`],
    done: `Print("It looks like you've installed Clippy! Would you like help?")`,
    code: () => startService,
  },
  vapor: {
    title: "Vapor",
    about: `' Save this as C:\\MYFILES\\INSTALL.SPK in SPARK and press F5. It makes this
' machine a Vapor games store: the store's files go in C:\\WEB\\VAPOR (the web
' server hands them out at http://YOURNAME/vapor/), with every game cut into
' parts that fit a network message. It also puts the Vapor program in
' C:\\PROGRAMS\\VAPOR.SPK and starts it. Other machines get Vapor from the
' store's page, and download games from it. Your home page is not touched.`,
    copy: [["vapor/WEB", "C:\\WEB\\VAPOR"]],
    generated: vaporStore(),
    dirs: ["C:\\WEB\\VAPOR", "C:\\WEB\\VAPOR\\VAPOR", ...vaporGames.filter((g) => !g.soon).map((g) => "C:\\WEB\\VAPOR\\" + g.id)],
    first: [],
    last: [`SYS.Start("C:\\PROGRAMS\\VAPOR.SPK", "")`],
    done: `Print("Vapor is running, and this machine is a store: http://" + NET.HostName.Lower() + "/vapor/")`,
    code: () => "",
  },
  eliza: {
    vapor: { id: "ELIZA", name: "ELIZA-95", kind: "web", category: "Fun", run: "/", tasks: "", startup: "", about: "A chatbot with large-language-model manners and the occasional real answer. Becomes this machine's home page." },
    title: "ELIZA-95",
    about: `' Save this as C:\\MYFILES\\INSTALL.SPK in SPARK and press F5. It puts ELIZA-95
' in C:\\WEB as this machine's home page (the stock INDEX.HTM moves to
' WELCOME.HTM). Conversations live in C:\\BOTDATA. If this machine also has an
' AskSim index in C:\\ASKDATA, ELIZA-95 answers "what is ...?" from it. Then open
' http://YOURNAME/ in Voyager.`,
    copy: [["eliza/WEB", "C:\\WEB"]],
    dirs: [],
    first: ["MoveHomePage()"],
    last: [],
    url: "/",
    code: () => moveHomePage,
  },
};

function build(key) {
  const app = apps[key];
  const files = [];
  for (const [from, to] of app.copy) for (const f of fs.readdirSync(path.join(root, from)).sort()) files.push({ text: () => read(path.join(from, f)), dest: to + "\\" + f.toUpperCase() });
  for (const g of app.generated || []) files.push(g);
  let out = `' INSTALL.SPK - puts ${app.title} on this machine. Generated by tools/build-installer.mjs;
' edit the files in ${key}/ and rebuild rather than editing this.
'
${app.about}

VAR t AS String
VAR NL AS String

SUB Main ()
    NL = Chr(10)
${app.dirs.map((d) => `    IF NOT FS.Exists(${lit(d)}) THEN FS.MakeDir(${lit(d)})`).join("\n")}
${app.dist ? `    IF NOT FS.Exists(${lit(app.dist)}) THEN FS.MakeDir(${lit(app.dist)})\n    FS.Write(${lit(app.dist + "\\MANIFEST.TXT")}, "")` : ""}
${app.first.map((s) => "    " + s).join("\n")}
${files.map((f, i) => `    File${i}()`).join("\n")}
    Print("${app.title} is installed (${files.length} files).")
${app.last.map((s) => "    " + s).join("\n")}
    ${app.done || `Print("Open http://" + NET.HostName.Lower() + "${app.url} in Voyager.")`}
END SUB

SUB Put (path AS String)
    FS.Write(path, t)
    Print("  wrote " + path)
END SUB
`;
  files.forEach((f, i) => {
    const lines = f.text().replace(/\r/g, "").split("\n");
    if (lines[lines.length - 1] === "") lines.pop();
    out += `\nSUB File${i} ()\n    t = ""\n`;
    for (const l of lines) out += `    t = t + ${lit(l)} + NL\n`;
    out += `    Put(${lit(f.dest)})\n`;
    if (app.dist) out += `    FS.Write(${lit(app.dist + "\\" + i + ".TXT")}, t)\n    FS.Append(${lit(app.dist + "\\MANIFEST.TXT")}, ${lit(i + "|" + f.dest)} + NL)\n`;
    out += `END SUB\n`;
  });
  out += app.code();
  // the header Vapor reads, so this installer can be published in a Vapor store
  if (app.vapor) out = withHeader({ ...app.vapor, files: files.map((f) => f.dest).join(";") }, out);
  fs.writeFileSync(path.join(root, key, "INSTALL.SPK"), out);
  console.log(`${key}/INSTALL.SPK: ${files.length} files, ${out.length} bytes`);
}

const wanted = process.argv.slice(2);
for (const key of wanted.length ? wanted : Object.keys(apps)) {
  if (!apps[key]) throw new Error("No app called " + key + "; there are " + Object.keys(apps).join(", "));
  build(key);
}
