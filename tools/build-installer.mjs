// Builds each app's INSTALL.SPK: one SPARK program that writes every file of the
// app onto a SIM95 disk. Paste it into SPARK, save it, press F5.
//   node tools/build-installer.mjs            (all of them)
//   node tools/build-installer.mjs coldmail   (one)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

const apps = {
  simbook: {
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
  eliza: {
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
  fs.writeFileSync(path.join(root, key, "INSTALL.SPK"), out);
  console.log(`${key}/INSTALL.SPK: ${files.length} files, ${out.length} bytes`);
}

const wanted = process.argv.slice(2);
for (const key of wanted.length ? wanted : Object.keys(apps)) {
  if (!apps[key]) throw new Error("No app called " + key + "; there are " + Object.keys(apps).join(", "));
  build(key);
}
