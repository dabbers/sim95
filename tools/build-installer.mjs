// Builds each app's INSTALL.SPK: one SPARK program that writes every file of the
// app onto a SIM95 disk. Paste it into SPARK, save it, press F5.
//   node tools/build-installer.mjs            (all of them)
//   node tools/build-installer.mjs coldmail   (one)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { simxplorerSource } from "./simxplorer-source.mjs";

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
  return "' VAPOR|" + ["id", "name", "kind", "version", "category", "run", "files", "tasks", "startup", "folder", "about"].map((k) => k + "=" + clean(meta[k])).join("|");
}
// A catalog line for a file with a header:
//   id|name|parts|bytes|status|category|about|kind|version|run|files|tasks|startup|folder
function catalogLine(text, parts) {
  const m = Object.fromEntries(text.split("\n")[0].slice("' VAPOR|".length).split("|").map((kv) => [kv.slice(0, kv.indexOf("=")), kv.slice(kv.indexOf("=") + 1)]));
  return [m.id, m.name, parts, text.length, "ok", m.category, m.about, m.kind, m.version, m.run, m.files, m.tasks, m.startup, m.folder ?? ""].join("|");
}
const withHeader = (meta, body) => header({ ...meta, version: version(body) }) + "\n" + body;
const vaporClient = () => withHeader({ id: "VAPOR", name: "Vapor", kind: "client", category: "Vapor", run: "C:\\PROGRAMS\\VAPOR.SPK", files: "C:\\PROGRAMS\\VAPOR.SPK", tasks: "VAPOR", about: "The Vapor program itself." }, read("vapor/PROGRAMS/VAPOR.SPK"));
const gameText = (g) => withHeader({ id: g.id, name: g.name, kind: "game", category: g.genre, run: `C:\\GAMES\\${g.id}\\${g.id}.SPK`, files: `C:\\GAMES\\${g.id}\\${g.id}.SPK`, tasks: g.id, about: g.about }, read(`vapor/GAMES/${g.id}.SPK`));
const stocked = ["simplayer"];
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
  // programs every store has on its shelves from the start
  for (const key of stocked) {
    const text = makeInstaller(key).text;
    const id = /\|id=([^|]*)/.exec(text)[1];
    const parts = cut(text);
    parts.forEach((p, i) => files.push({ dest: `C:\\WEB\\VAPOR\\${id}\\${i + 1}.TXT`, text: () => p }));
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

// How each web app shows on a SimHost front page: its installer leaves this in
// its folder as APP.INF (name|blurb|colour), and the front page lists every
// folder that has one. An app not listed here gets the first sentence of its
// Vapor blurb.
const portal = {
  BOOK: ["The social network: profiles, friends, a news feed, walls, photos and pokes.", "#3B5998"],
  MAIL: ["Free webmail, with a real mail server behind it.", "#2E5E8C"],
  ASK: ["A search engine with a real crawler that goes round every machine on the network.", "#8B1A1A"],
  GEO: ["Free homepages for everybody: neighborhoods, hit counters, guestbooks and webrings.", "#008080"],
  ELIZA: ["A chatbot with Language-Model-of-Certain-Size manners.", "#2F6F4F"],
  PAL: ["Send and request money in SimBucks, and pay at any shop with a Pay with SimPal button.", "#003087"],
  TUBE: ["Movies: watch them, put yours up, give them stars. They play in SimPlayer.", "#CC0000"],
  STATS: ["Web statistics for any site: hits, visitors, top pages, referrers and a hit counter.", "#003366"],
  DNS: ["Register your own domain name (.sim, .com, .net, .org), point it at any machine, and host your site here.", "#000066"],
};
const appInf = (app) => {
  const [blurb, colour] = portal[app.folder] || [String(app.vapor?.about || app.title).split(/(?<=\.) /)[0], "#000080"];
  return [app.vapor?.name || app.title, blurb, colour].map((v) => v.replace(/[|\r\n]/g, " ")).join("|");
};

const apps = {
  simbook: {
    folder: "BOOK",
    vapor: { folder: "BOOK", id: "SIMBOOK", name: "SimBook", kind: "web", category: "Social", run: "/", tasks: "", startup: "", about: "The social network for the SIM95 network: profiles, friends, a news feed, walls, photos and pokes. Becomes this machine's home page, or on a SimHost machine gets a folder of its own." },
    title: "SimBook",
    about: `' Save this as C:\\MYFILES\\INSTALL.SPK in SPARK and press F5. SimBook becomes
' this machine's home page: its pages go into C:\\WEB, and the stock INDEX.HTM is
' moved aside to WELCOME.HTM, so the web server falls back to INDEX.ASP. It
' leaves C:\\BOOKDATA (accounts, posts) alone, so running it again upgrades
' SimBook without losing anybody. Then open http://YOURNAME/ in Voyager.`,
    copy: [["simbook/WEB", "C:\\WEB"]],
    dirs: ["C:\\WEB\\PICS"],
    moreDirs: ["C:\\WEB\\PHOTOS"],
    first: ["MoveHomePage()", "Migrate()"],
    last: [],
    url: "/",
    code: () => moveHomePage + "\n" + read("simbook/MIGRATE.SPK"),
  },
  coldmail: {
    folder: "MAIL",
    vapor: { folder: "MAIL", id: "COLDMAIL", name: "ColdMail", kind: "web", category: "Internet", run: "/", tasks: "MAILD", startup: "MAIL.RUN", about: "Free webmail and a real mail server: send letters to anybody on any machine. Becomes this machine's home page, or on a SimHost machine gets a folder of its own." },
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
    folder: "ASK",
    vapor: { folder: "ASK", id: "ASKSIM", name: "AskSim", kind: "web", category: "Internet", run: "/", tasks: "CRAWLER", startup: "ASKSIM.RUN", about: "A search engine with a real crawler that goes round every machine on the network. Becomes this machine's home page, or on a SimHost machine gets a folder of its own." },
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
' C:\\SYSTEM\\SIMXPLOR.INI. It also puts a demo in C:\\WEB\\SXDEMO (the Live
' Page, at http://YOURNAME/sxdemo/ when the web server runs) with SNIFF.SPK,
' which tells server pages which browser is asking. The home page is not touched.`,
    // the demo, and SNIFF.SPK for other web apps to import
    copy: [["simxplorer/WEB", "C:\\WEB\\SXDEMO"]],
    // the engine, the window and SimPlayer, joined into one program
    generated: [{ dest: "C:\\PROGRAMS\\SIMXPLOR.SPK", text: simxplorerSource }],
    dirs: ["C:\\WEB\\SXDEMO"],
    first: [],
    last: [`SYS.Start("C:\\PROGRAMS\\SIMXPLOR.SPK", "")`],
    done: `Print("Simxplorer is running. Next time, start C:\\PROGRAMS\\SIMXPLOR.SPK from Files. Its demo: http://" + NET.HostName.Lower() + "/sxdemo/")`,
    code: () => "",
  },
  simplayer: {
    vapor: { id: "SIMPLAYR", name: "SimPlayer", kind: "program", category: "Multimedia", run: "C:\\PROGRAMS\\PLAYER.SPK", tasks: "PLAYER", startup: "", about: "The movie player for SIM95: plays SimMovies from the disk or streams them from the web, like the ones on SimTube. (Simxplorer has it built in.)" },
    title: "SimPlayer",
    about: `' Save this as C:\\MYFILES\\INSTALL.SPK in SPARK and press F5. It writes
' SimPlayer, the movie player, to C:\\PROGRAMS\\PLAYER.SPK and starts it. It plays
' SimMovies (.SMV) from the disk, or streams them from a web address such as
' a SimTube movie's. Simxplorer has SimPlayer built in; this is the same
' player on its own, for Voyager users and for movies on the disk.`,
    copy: [],
    generated: [{ dest: "C:\\PROGRAMS\\PLAYER.SPK", text: () => read("simplayer/src/PLAYER.SPK") }],
    dirs: [],
    first: [],
    last: [`SYS.Start("C:\\PROGRAMS\\PLAYER.SPK", "")`],
    done: `Print("SimPlayer is running. Next time, start C:\\PROGRAMS\\PLAYER.SPK from Files, or give it a movie's address.")`,
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
    generated: () => vaporStore(),
    dirs: ["C:\\WEB\\VAPOR", "C:\\WEB\\VAPOR\\VAPOR", "C:\\WEB\\VAPOR\\SIMPLAYR", ...vaporGames.filter((g) => !g.soon).map((g) => "C:\\WEB\\VAPOR\\" + g.id)],
    first: [],
    last: [`SYS.Start("C:\\PROGRAMS\\VAPOR.SPK", "")`],
    done: `Print("Vapor is running, and this machine is a store: http://" + NET.HostName.Lower() + "/vapor/")`,
    code: () => "",
  },
  simhost: {
    vapor: { id: "SIMHOST", name: "SimHost", kind: "program", category: "System", run: "C:\\PROGRAMS\\MOVEIN.SPK", tasks: "MOVEIN", startup: "", about: "Run every web app on one machine: SimBook, ColdMail, AskSim and ELIZA-95 each get a folder, the home page lists them, and Move In brings over your other machines' data." },
    title: "SimHost",
    about: `' Save this as C:\\MYFILES\\INSTALL.SPK in SPARK and press F5. It makes this
' machine a host for every web app at once: C:\\SYSTEM\\WEBAPPS.INI says
' mode=folders, so SimBook, ColdMail, AskSim and ELIZA-95 each install into a
' folder of their own (http://YOURNAME/book/, /mail/, /ask/, /eliza/). Any of
' them already here as the home page moves into its folder, the stock
' INDEX.HTM moves aside to WELCOME.HTM, and the home page becomes a list of
' them all. It also writes C:\\PROGRAMS\\MOVEIN.SPK, which copies another
' machine's data (posts, mail, saves...) here, so that machine can be closed.`,
    copy: [["simhost/WEB", "C:\\WEB"], ["simhost/PROGRAMS", "C:\\PROGRAMS"]],
    dirs: [],
    first: ["SetUpHost()"],
    last: [],
    done: `Print("Open http://" + NET.HostName.Lower() + "/ in Voyager. Then install the web apps (in any order), and run C:\\PROGRAMS\\MOVEIN.SPK to bring your other machines' data here.")`,
    code: () => moveHomePage + "\n" + read("simhost/SETUP.SPK") + relocateCode(),
  },
  geosimies: {
    folder: "GEO",
    vapor: { folder: "GEO", id: "GEOSIMIE", name: "GeoSimies", kind: "web", category: "Internet", run: "/", tasks: "", startup: "", about: "Free homepages for everybody: neighborhoods, a page editor with templates and clip art, hit counters, guestbooks and webrings. Becomes this machine's home page, or on a SimHost machine gets a folder of its own." },
    title: "GeoSimies",
    about: `' Save this as C:\\MYFILES\\INSTALL.SPK in SPARK and press F5. GeoSimies
' becomes this machine's home page: its pages go into C:\\WEB (the stock
' INDEX.HTM moves to WELCOME.HTM) and its clip art into C:\\WEB\\CLIPART.
' Members' homepages get folders of their own there (C:\\WEB\\AREA95\\1001...).
' Everything people write is kept in C:\\GEODATA, which is left alone, so
' running this again upgrades GeoSimies without losing anybody's homepage.
' Then open http://YOURNAME/ in Voyager.`,
    copy: [["geosimies/WEB", "C:\\WEB"], ["geosimies/CLIPART", "C:\\WEB\\CLIPART"]],
    dirs: ["C:\\WEB\\CLIPART"],
    // the neighborhoods' folders, which SimHost moves along with the rest
    moreDirs: ["AREA95", "SIMWOOD", "CHIPVALE", "HOMETOWN", "NEOTOKYO", "ROCKCITY", "STADIUM", "TOYLAND"].map((h) => "C:\\WEB\\" + h),
    first: ["MoveHomePage()"],
    last: [],
    url: "/",
    code: () => moveHomePage,
  },
  simpal: {
    folder: "PAL",
    vapor: { folder: "PAL", id: "SIMPAL", name: "SimPal", kind: "web", category: "Internet", run: "/", tasks: "", startup: "", about: "Send money, request money, and Pay with SimPal on any web site, in SimBucks. Becomes this machine's home page, or on a SimHost machine gets a folder of its own." },
    title: "SimPal",
    about: `' Save this as C:\\MYFILES\\INSTALL.SPK in SPARK and press F5. It puts SimPal
' in C:\\WEB as this machine's home page (the stock INDEX.HTM moves to
' WELCOME.HTM), and C:\\PROGRAMS\\PALCHECK.SPK, which shops' pages on this
' machine import to check receipts. Accounts and the ledger in C:\\PALDATA are
' left alone, so running it again upgrades SimPal without losing a penny. Then
' open http://YOURNAME/ in Voyager.`,
    copy: [["simpal/WEB", "C:\\WEB"], ["simpal/PROGRAMS", "C:\\PROGRAMS"]],
    dirs: [],
    first: ["MoveHomePage()"],
    last: [],
    url: "/",
    code: () => moveHomePage,
  },
  simtube: {
    folder: "TUBE",
    vapor: { folder: "TUBE", id: "SIMTUBE", name: "SimTube", kind: "web", category: "Fun", run: "/", tasks: "", startup: "", about: "Movies for the SIM95 network: watch, upload, rate and comment. Movies play in Simxplorer (SimPlayer is built in) or in SimPlayer from Vapor. Becomes this machine's home page, or on a SimHost machine gets a folder of its own." },
    title: "SimTube",
    about: `' Save this as C:\\MYFILES\\INSTALL.SPK in SPARK and press F5. SimTube becomes
' this machine's home page: its pages go into C:\\WEB (the stock INDEX.HTM moves
' to WELCOME.HTM). The sample movies wait in C:\\TUBEDATA\\SEED until the first
' visit to the front page puts them up. Movies, accounts and comments in
' C:\\TUBEDATA are left alone, so running it again upgrades SimTube. Then open
' http://YOURNAME/ in Voyager. Movies play in Simxplorer, which has SimPlayer
' built in, or in SimPlayer on its own (from Vapor).`,
    copy: [["simtube/WEB", "C:\\WEB"]],
    // the sample movies, made by tools/make-movies.mjs
    generated: fs.readdirSync(path.join(root, "simtube/MOVIES")).sort().map((f) => ({ dest: "C:\\TUBEDATA\\SEED\\" + f.toUpperCase(), text: () => read("simtube/MOVIES/" + f) })),
    dirs: [],
    first: ["MoveHomePage()", "TubeDirs()"],
    last: [],
    url: "/",
    code: () => moveHomePage + `
' Where the movies live, outside C:\\WEB, and where the samples wait.
SUB TubeDirs ()
    IF NOT FS.Exists("C:\\TUBEDATA") THEN FS.MakeDir("C:\\TUBEDATA")
    IF NOT FS.Exists("C:\\TUBEDATA\\SEED") THEN FS.MakeDir("C:\\TUBEDATA\\SEED")
END SUB
`,
  },
  simstats: {
    folder: "STATS",
    vapor: { folder: "STATS", id: "SIMSTATS", name: "SimStats", kind: "web", category: "Internet", run: "/", tasks: "", startup: "", about: "Free web statistics for any site on the network: hits, unique visitors, top pages, referrers, browsers, live traffic and LED hit counters. Becomes this machine's home page, or on a SimHost machine gets a folder of its own." },
    title: "SimStats",
    about: `' Save this as C:\\MYFILES\\INSTALL.SPK in SPARK and press F5. SimStats becomes
' this machine's home page: its pages go into C:\\WEB (the stock INDEX.HTM moves
' to WELCOME.HTM). On a SimHost machine it goes in C:\\WEB\\STATS instead, and
' the front page counts its own visitors with it. Accounts and statistics are
' kept in C:\\STATDATA, which is left alone, so running it again upgrades
' SimStats without losing a hit. It also adds a line to C:\\WEB\\ROBOTS.TXT so
' AskSim's crawler leaves the tracking tag alone. Then open http://YOURNAME/
' in Voyager.`,
    copy: [["simstats/WEB", "C:\\WEB"]],
    dirs: [],
    first: ["MoveHomePage()", "StatsSetup()"],
    last: [],
    url: "/",
    code: () => moveHomePage + `
' Where SimStats keeps its numbers, outside C:\\WEB. Also "this machine": a site
' that belongs to nobody (the machine's owner sees it on admin.asp), which the
' SimHost front page counts its visitors with. Its id is in C:\\STATDATA\\HOME.TXT.
SUB StatsSetup ()
    VAR dirs AS Array OF String
    VAR dir AS String
    VAR id AS String
    VAR robots AS String
    VAR rule AS String
    dirs = ["C:\\STATDATA", "C:\\STATDATA\\USERS", "C:\\STATDATA\\SESSIONS", "C:\\STATDATA\\S"]
    FOR EACH dir IN dirs
        IF NOT FS.Exists(dir) THEN FS.MakeDir(dir)
    NEXT
    IF NOT FS.Exists("C:\\STATDATA\\HOME.TXT") THEN
        id = Hex(268435456 + Rnd(1879048191))
        IF NOT FS.Exists("C:\\STATDATA\\S\\" + id) THEN FS.MakeDir("C:\\STATDATA\\S\\" + id)
        FS.Append("C:\\STATDATA\\SITES.TXT", id + "||This machine (" + NET.HostName.Upper() + ")|http://" + NET.HostName.Lower() + "/|0|" + TIME.Date + "|1" + NL)
        FS.Write("C:\\STATDATA\\HOME.TXT", id)
        Print("  made the site " + id + " for this machine itself")
    END IF
    ' AskSim's crawler reads /robots.txt: it has no business with the tag
    rule = "Disallow: /hit.asp"
    IF intoDir <> "" THEN rule = "Disallow: /" + intoDir.Lower() + "/hit.asp"
    robots = ""
    IF FS.Exists("C:\\WEB\\ROBOTS.TXT") THEN robots = FS.Read("C:\\WEB\\ROBOTS.TXT")
    IF NOT robots.Contains(rule) THEN
        IF robots = "" THEN robots = "User-agent: *" + NL
        IF NOT robots.EndsWith(NL) THEN robots = robots + NL
        FS.Write("C:\\WEB\\ROBOTS.TXT", robots + rule + NL)
        Print("  told crawlers to keep off the tag in C:\\WEB\\ROBOTS.TXT")
    END IF
END SUB
`,
  },
  simsh: {
    vapor: { id: "SIMSH", name: "Sim Shell", kind: "program", category: "System", run: "C:\\PROGRAMS\\SIMSH.SPK", tasks: "SIMSH;SSHD", startup: "SSHD.RUN", about: "A bash-like shell for SIM95: ls, cd, cat, grep, pipes, redirects, variables, aliases and .SH scripts, plus ssh/scp over the network (rsh with a password; not secure) and sim-get, an apt-like front end to the Vapor store. Installs the sshd server too." },
    title: "Sim Shell",
    about: `' Save this as C:\\MYFILES\\INSTALL.SPK in SPARK and press F5. It writes the Sim
' Shell to C:\\PROGRAMS\\SIMSH.SPK and its remote-shell server to
' C:\\PROGRAMS\\SSHD.SPK, both sharing one shell engine, starts the server, and
' adds it to C:\\SYSTEM\\STARTUP\\SSHD.RUN so it runs whenever the machine does.
' It writes an example C:\\SYSTEM\\SIMSHRC.SH the first time only. The shell
' then opens. SSHD is rsh with a password: not secure (see README.md).`,
    copy: [],
    // the shell engine (CORE.SPK) is built into both programs by the builder
    generated: [
      { dest: "C:\\PROGRAMS\\SIMSH.SPK", text: () => read("simsh/src/CORE.SPK") + "\n" + read("simsh/src/NETJOB.SPK") + "\n" + read("simsh/src/WINDOW.SPK") },
      { dest: "C:\\PROGRAMS\\SSHD.SPK", text: () => read("simsh/src/CORE.SPK") + "\n" + read("simsh/src/SSHD.SPK") },
    ],
    dirs: [],
    first: ["MakeRc()"],
    last: [`StartService("SSHD", "C:\\PROGRAMS\\SSHD.SPK", "SSHD.RUN")`, `SYS.Start("C:\\PROGRAMS\\SIMSH.SPK", "")`],
    done: `Print("The Sim Shell is open, and sshd is listening on port 22. Next time, start C:\\PROGRAMS\\SIMSH.SPK from Files.")`,
    code: () => startService + read("simsh/src/SIMSHRC.SPK"),
  },
  simdns: {
    folder: "DNS",
    vapor: { folder: "DNS", id: "SIMDNS", name: "SimDNS", kind: "web", category: "Internet", run: "/", tasks: "NAMED", startup: "NAMED.RUN", about: "Domain names for the SIM95 network: a name server (NAMED), SimNIC the registrar, DIG, and a web server that hosts many sites on one machine. Becomes this machine's home page, or on a SimHost machine gets a folder of its own." },
    title: "SimDNS",
    about: `' Save this as C:\\MYFILES\\INSTALL.SPK in SPARK and press F5. It makes this
' machine a name server and a registrar. The name server, C:\\PROGRAMS\\NAMED.SPK,
' answers for the zones in C:\\DNS (listed in C:\\DNS\\NAMED.CNF); it starts now
' and with the machine (C:\\SYSTEM\\STARTUP\\NAMED.RUN). SimNIC, the registrar,
' becomes the home page (the stock INDEX.HTM moves to WELCOME.HTM), or goes in
' C:\\WEB\\DNS on a SimHost machine. It also writes DIG.SPK (ask a name server)
' and RESOLVE.SPK (the resolver, for your own programs), and replaces the web
' server with one that serves several sites by name (C:\\WEB\\VHOSTS.TXT). The
' old web server is kept as C:\\PROGRAMS\\HTTPD.ORG and comes back if SimDNS is
' uninstalled. Accounts and domains in C:\\NICDATA and zones in C:\\DNS are left
' alone, so running this again upgrades SimDNS.`,
    copy: [["simdns/WEB", "C:\\WEB"]],
    generated: [
      { dest: "C:\\PROGRAMS\\NAMED.SPK", text: () => read("simdns/src/NAMED.SPK") },
      { dest: "C:\\PROGRAMS\\DIG.SPK", text: () => read("simdns/src/DIG.SPK") + "\n" + read("simdns/src/RESOLVE.SPK") },
      { dest: "C:\\PROGRAMS\\RESOLVE.SPK", text: () => read("simdns/src/RESOLVE.SPK") },
      // the web server is the machine's own: Vapor must never delete it (it
      // goes back to HTTPD.ORG by itself when NAMED.SPK is gone)
      { dest: "C:\\PROGRAMS\\HTTPD.SPK", text: () => read("simdns/src/HTTPD.SPK"), keep: true },
    ],
    dirs: [],
    first: ["MoveHomePage()", "DnsSetup()"],
    last: [`StartService("NAMED", "C:\\PROGRAMS\\NAMED.SPK", "NAMED.RUN")`, "RestartWeb()"],
    url: "/",
    code: () => startService + moveHomePage + "\n" + read("simdns/SETUP.SPK"),
  },
  eliza: {
    folder: "ELIZA",
    vapor: { folder: "ELIZA", id: "ELIZA", name: "ELIZA-95", kind: "web", category: "Fun", run: "/", tasks: "", startup: "", about: "A chatbot with Language-Model-of-Certain-Size manners, games, jokes and the occasional real answer. Becomes this machine's home page, or on a SimHost machine gets a folder of its own." },
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

// SimHost moves web apps that were installed as the home page into their
// folders. It knows what each one wrote in C:\WEB from the lists above.
function relocateCode() {
  const web = (key) => apps[key].copy.filter(([, to]) => to === "C:\\WEB").flatMap(([from]) => fs.readdirSync(path.join(root, from)).map((f) => f.toUpperCase()));
  const keys = Object.keys(apps).filter((k) => apps[k].folder);
  const count = {};
  for (const k of keys) for (const f of web(k)) count[f] = (count[f] || 0) + 1;
  const marker = { simbook: "BOOK.SPK", coldmail: "MAIL.SPK", asksim: "ASK.SPK", geosimies: "GEO.SPK", simpal: "PAL.SPK", simtube: "TUBE.SPK", simstats: "STATS.SPK", simdns: "NIC.SPK", eliza: "BOT.SPK" };
  const calls = keys.map((k) => {
    const a = apps[k];
    const files = web(k);
    const dirs = [...a.dirs, ...(a.dist ? [a.dist] : []), ...(a.moreDirs || [])].map((d) => d.slice("C:\\WEB\\".length));
    return `    MoveApp(${lit(a.title)}, ${lit(a.folder)}, ${lit(marker[k])}, ${lit(files.join(";"))}, ${lit(files.filter((f) => count[f] > 1).join(";"))}, ${lit(dirs.join(";"))})`;
  });
  return `\nSUB Relocate ()\n${calls.join("\n")}\nEND SUB\n`;
}

function build(key) {
  const out = makeInstaller(key);
  fs.writeFileSync(path.join(root, key, "INSTALL.SPK"), out.text);
  console.log(`${key}/INSTALL.SPK: ${out.files} files, ${out.text.length} bytes`);
}

function makeInstaller(key) {
  const app = apps[key];
  const files = [];
  for (const [from, to] of app.copy) for (const f of fs.readdirSync(path.join(root, from)).sort()) files.push({ text: () => read(path.join(from, f)), dest: to + "\\" + f.toUpperCase() });
  for (const g of (typeof app.generated === "function" ? app.generated() : app.generated) || []) files.push(g);
  let out = `' INSTALL.SPK - puts ${app.title} on this machine. Generated by tools/build-installer.mjs;
' edit the files in ${key}/ and rebuild rather than editing this.
'
${app.about}

VAR t AS String
VAR NL AS String
VAR intoDir AS String   ' "" for the web root, or the folder this web app goes in

SUB Main ()
    NL = Chr(10)
${app.folder ? `    ' On a machine set up for several web apps (SimHost: C:\\SYSTEM\\WEBAPPS.INI
    ' says mode=folders), this one goes in C:\\WEB\\${app.folder} and leaves the home page alone.
    IF FS.Exists("C:\\SYSTEM\\WEBAPPS.INI") THEN
        IF FS.Read("C:\\SYSTEM\\WEBAPPS.INI").Contains("mode=folders") THEN intoDir = "${app.folder}"
    END IF
    IF intoDir <> "" AND NOT FS.Exists("C:\\WEB\\" + intoDir) THEN FS.MakeDir("C:\\WEB\\" + intoDir)` : ""}
${app.dirs.map((d) => `    IF NOT FS.Exists(Dest(${lit(d)})) THEN FS.MakeDir(Dest(${lit(d)}))`).join("\n")}
${app.dist ? `    IF NOT FS.Exists(Dest(${lit(app.dist)})) THEN FS.MakeDir(Dest(${lit(app.dist)}))\n    FS.Write(Dest(${lit(app.dist + "\\MANIFEST.TXT")}), "")` : ""}
${app.first.map((s) => "    " + (s === "MoveHomePage()" ? `IF intoDir = "" THEN MoveHomePage()` : s)).join("\n")}
${files.map((f, i) => `    File${i}()`).join("\n")}
    Print("${app.title} is installed (${files.length} files).")
${app.last.map((s) => "    " + s).join("\n")}
${app.folder ? `    ' how it shows on the SimHost front page, which lists every folder with one of these
    IF intoDir <> "" THEN FS.Write("C:\\WEB\\" + intoDir + "\\APP.INF", ${lit(appInf(app))})` : ""}
    ${app.done || (app.folder ? `IF intoDir = "" THEN
        Print("Open http://" + NET.HostName.Lower() + "/ in Voyager.")
    ELSE
        Print("Open http://" + NET.HostName.Lower() + "/" + intoDir.Lower() + "/ in Voyager.")
    END IF` : `Print("Open http://" + NET.HostName.Lower() + "${app.url} in Voyager.")`)}
END SUB

' Where a file goes: in this web app's folder, on a machine that keeps them in folders.
FUNCTION Dest (path AS String) AS String
    IF intoDir <> "" AND path.Upper().StartsWith("C:\\WEB\\") THEN RETURN "C:\\WEB\\" + intoDir + "\\" + path.Substring(7, path.Length - 7)
    RETURN path
END FUNCTION

SUB Put (path AS String)
    FS.Write(Dest(path), t)
    Print("  wrote " + Dest(path))
END SUB
`;
  files.forEach((f, i) => {
    const lines = f.text().replace(/\r/g, "").split("\n");
    if (lines[lines.length - 1] === "") lines.pop();
    out += `\nSUB File${i} ()\n    t = ""\n`;
    for (const l of lines) out += `    t = t + ${lit(l)} + NL\n`;
    out += `    Put(${lit(f.dest)})\n`;
    if (app.dist) out += `    FS.Write(Dest(${lit(app.dist + "\\" + i + ".TXT")}), t)\n    FS.Append(Dest(${lit(app.dist + "\\MANIFEST.TXT")}), ${lit(i + "|" + f.dest)} + NL)\n`;
    out += `END SUB\n`;
  });
  out += app.code();
  // the header Vapor reads, so this installer can be published in a Vapor store
  // (a file marked keep, such as a system program it replaces, is left off,
  // so uninstalling never deletes it)
  if (app.vapor) out = withHeader({ ...app.vapor, files: files.filter((f) => !f.keep).map((f) => f.dest).join(";") }, out);
  return { text: out, files: files.length };
}

const wanted = process.argv.slice(2);
for (const key of wanted.length ? wanted : Object.keys(apps)) {
  if (!apps[key]) throw new Error("No app called " + key + "; there are " + Object.keys(apps).join(", "));
  build(key);
}
