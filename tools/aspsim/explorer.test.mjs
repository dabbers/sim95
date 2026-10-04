// Tests for Explorer (explorer/): the Windows 95 file manager, with mapped
// network drives. ALPHA runs Explorer; BRAVO has files to share; NOBODY is a
// name no machine has. Explorer is driven as a person would: its menus, its
// keys, clicks on its canvas (in Details view, where row n is at a known
// place), and its dialogs.
//   node tools/aspsim/explorer.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Network } from "./network.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log("ok    " + name); }
  catch (e) { failures++; console.log("FAIL  " + name + "\n      " + String(e.message || e).split("\n").join("\n      ") + "\n      " + String(e.stack || "").split("\n").slice(1, 3).join("\n      ")); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const net = new Network();
// (and a moment after: Explorer finishes what it was doing before it takes the next command)
const wait = async (fn, what, ms = 15000) => { const r = await net.until(fn, ms, what); await sleep(300); return r; };

async function boot(name) {
  const m = await net.boot(name);
  m.write("C:\\SYSTEM\\USERS.INI", "name=" + name.toLowerCase() + "\npassword=sekret\n");
  m.run("C:\\PROGRAMS\\FILESVC.SPK");
  return m;
}
const alpha = await boot("ALPHA");
const bravo = await boot("BRAVO");
for (const d of ["C:\\MYFILES\\PROJECTS", "C:\\MYFILES\\PROJECTS\\SITE"]) alpha.mkdir(d);
alpha.write("C:\\MYFILES\\NOTES.TXT", "my notes\n");
alpha.write("C:\\MYFILES\\TODO.TXT", "1. explore\n");
alpha.write("C:\\MYFILES\\PROJECTS\\PLAN.TXT", "the plan\n");
alpha.write("C:\\MYFILES\\PROJECTS\\SITE\\INDEX.HTM", "<html>site</html>");
bravo.mkdir("C:\\MYFILES\\SHARED");
bravo.write("C:\\MYFILES\\SHARED\\README.TXT", "from bravo\n");
bravo.write("C:\\MYFILES\\BRAVO.TXT", "bravo's own\n");

// Explorer, as a test drives it
function explorer(m, ...args) {
  const pid = m.run("C:\\PROGRAMS\\EXPLORER.SPK", args);
  const x = {
    pid,
    win: () => m.widgets(pid, "Window").find((w) => String(w.get("Title")).startsWith("Exploring") || w === m.widgets(pid, "Window")[0]),
    main: () => m.widgets(pid, "Window")[0],
    title: () => String(x.main()?.get("Title") ?? ""),
    status: () => String(x.main()?.get("Status") ?? ""),
    address: () => m.widgets(pid, "TextBox")[0].get("Text"),
    canvas: () => m.widgets(pid, "Canvas")[1],
    keysButton: () => m.widgets(pid, "Button").find((b) => b.get("Width") === 1),
    // the words on the canvas now: the tree's last paint, and the files' (each
    // starts by filling its pane with white: the tree's at x 2, the files' further right)
    drawn: () => {
      if (!x.canvas()) return [];
      const ops = x.canvas().ops || [];
      const fills = ops.map((o, i) => (o[0] === "FillRect" && o[2] === 22 && o[4] > 18 ? i : -1)).filter((i) => i >= 0);
      const treeAt = fills.filter((i) => ops[i][1] === 2).pop() ?? -1;
      const listAt = fills.filter((i) => ops[i][1] > 2).pop() ?? -1;
      const treeEnd = fills.find((i) => i > treeAt && ops[i][1] > 2) ?? ops.length;
      const text = (a, b) => ops.slice(a, b).filter((o) => o[0] === "Text").map((o) => o[3]);
      return [...(treeAt >= 0 ? text(treeAt, treeEnd) : []), ...(listAt >= 0 ? text(listAt, ops.length) : [])];
    },
    menu: (item) => m.widgets(pid, "Menu")[0].fire("onSelect", item),
    ctxItems: () => m.widgets(pid, "Menu")[1].items,
    key: (k) => x.keysButton().fire("onKey", k),
    async go(where) {
      const box = m.widgets(pid, "TextBox")[0];
      box.set("Text", where);
      box.fire("onEnter");
      await x.idle();
    },
    // Details view: row n of the files
    rowY: (n) => 20 + 2 + 18 + n * 18 + 9,
    rowX: () => 230 + 5 + 2 + 30,
    async click(n, button = 1) {
      x.canvas().fire("onMouseDown", x.rowX(), x.rowY(n), button);
      x.canvas().fire("onMouseUp", x.rowX(), x.rowY(n), button);
      await sleep(150);
    },
    async open(n) {
      await x.click(n);
      await x.click(n);
      await x.idle();
    },
    // (a dialog is shown once it's all made)
    dialog: (title) => m.widgets(pid, "Window").find((w) => String(w.get("Title")) === title && w.get("Visible") === true),
    async idle(ms = 400) { await sleep(ms); },
  };
  return x;
}
const names = (x) => x.drawn();

await test("installing: EXPLORER.SPK, and Files made into a launcher for it when wanted (the old one kept)", async () => {
  const installer = fs.readFileSync(path.join(root, "explorer/INSTALL.SPK"), "utf8");
  assert.match(installer, /^' VAPOR\|id=EXPLORER\|name=Explorer\|kind=program\|version=[0-9a-f]{8}\|category=System\|run=C:\\PROGRAMS\\EXPLORER\.SPK\|files=C:\\PROGRAMS\\EXPLORER\.SPK\|/);
  const stock = alpha.read("C:\\PROGRAMS\\FILES.SPK");
  alpha.write("C:\\MYFILES\\INSTALL.SPK", installer);
  alpha.ui.answers.push(true);
  let pid = alpha.run("C:\\MYFILES\\INSTALL.SPK");
  await wait(() => !alpha.running(pid), "the installer", 120000);
  assert.match(alpha.output(pid), /My Computer and My Files open Explorer now \(the old Files is FILES\.BAK\)/);
  assert.equal(alpha.read("C:\\PROGRAMS\\FILES.BAK"), stock);
  assert.match(alpha.read("C:\\PROGRAMS\\FILES.SPK"), /\(EXPLORER LAUNCHER\)/);
  // the desktop's My Computer runs FILES.SPK C:\ - that's My Computer
  const before = Math.max(...alpha.kernel.ps().map((p) => p.pid));
  pid = alpha.run("C:\\PROGRAMS\\FILES.SPK", ["C:\\"]);
  await wait(() => alpha.ui.widgets.some((w) => w.pid > pid && w.type === "Window" && String(w.get("Title")) === "Exploring - My Computer"), "Explorer at My Computer");
  const ex = alpha.ui.widgets.find((w) => w.pid > before && w.pid !== pid && w.type === "Window");
  alpha.kernel.kill(ex.pid);
  // on BRAVO: no, thanks
  bravo.write("C:\\MYFILES\\INSTALL.SPK", installer);
  bravo.ui.answers.push(false);
  pid = bravo.run("C:\\MYFILES\\INSTALL.SPK");
  await wait(() => !bravo.running(pid), "BRAVO's installer", 120000);
  assert.match(bravo.output(pid), /Files is left as it is/);
  alpha.remove("C:\\MYFILES\\INSTALL.SPK");
  bravo.remove("C:\\MYFILES\\INSTALL.SPK");
  assert.equal(bravo.exists("C:\\PROGRAMS\\FILES.BAK"), false);
  assert.deepEqual(alpha.errors, []);
});

await test("browsing this machine: the tree, the files, Details, opening folders, Back and Up", async () => {
  const x = explorer(alpha, "C:\\MYFILES");
  await wait(() => x.title() === "Exploring - Myfiles", "the window: " + x.title());
  x.menu("Details");
  await x.idle();
  const seen = names(x);
  for (const w of ["All Folders", "Desktop", "My Computer", "(C:)", "Myfiles", "Network Neighborhood", "Recycle Bin", "Contents of 'Myfiles'", "Projects", "Notes.txt", "Todo.txt", "Text Document", "File Folder", "Name", "Size", "Type"]) assert.ok(seen.includes(w), w + " in " + JSON.stringify(seen));
  await wait(() => /^3 object\(s\)/.test(x.status()), "the status: " + x.status());
  // a double click on Projects (row 0, folders first)
  await x.open(0);
  await wait(() => x.title() === "Exploring - Projects", "into Projects: " + x.title());
  assert.equal(x.address(), "C:\\MYFILES\\PROJECTS");
  assert.ok(names(x).includes("Plan.txt"));
  x.key("Backspace");
  await wait(() => x.title() === "Exploring - Myfiles", "up");
  x.menu("Back");
  await wait(() => x.title() === "Exploring - Projects", "back");
  x.menu("Forward");
  await wait(() => x.title() === "Exploring - Myfiles", "forward");
  // a click picks; the status says so
  await x.click(1);
  await wait(() => /^1 object\(s\) selected/.test(x.status()), "one picked: " + x.status());
  x.menu("Select All");
  await wait(() => /^3 object\(s\) selected/.test(x.status()), "all picked: " + x.status());
  await x.go("My Computer");
  assert.equal(x.title(), "Exploring - My Computer");
  assert.ok(names(x).includes("(C:)"));
  alpha.kernel.kill(x.pid);
  assert.deepEqual(alpha.errors, []);
});

await test("another machine: \\\\BRAVO\\ asks for a password once, and a wrong one is asked again", async () => {
  const x = explorer(alpha, "C:\\MYFILES");
  await wait(() => x.title() === "Exploring - Myfiles", "the window");
  x.menu("Details");
  const going = x.go("\\\\BRAVO\\MYFILES");
  await wait(() => x.dialog("Enter Network Password"), "the password box");
  const lg = () => alpha.widgets(x.pid, "TextBox").slice(-2);
  lg()[0].set("Text", "bravo");
  lg()[1].set("Text", "wrong");
  alpha.widgets(x.pid, "CheckBox").slice(-1)[0].set("Checked", true);
  alpha.widgets(x.pid, "Button").filter((b) => b.get("Text") === "OK").slice(-1)[0].fire("onClick");
  await going;
  await wait(() => x.dialog("Enter Network Password") && alpha.widgets(x.pid, "Label").some((l) => /incorrect/.test(l.get("Text"))), "asked again");
  lg()[1].set("Text", "sekret");
  alpha.widgets(x.pid, "Button").filter((b) => b.get("Text") === "OK").slice(-1)[0].fire("onClick");
  await wait(() => x.title() === "Exploring - Myfiles" && names(x).includes("Bravo.txt"), "BRAVO's MYFILES: " + names(x).join(","));
  assert.equal(x.address(), "\\\\BRAVO\\MYFILES");
  assert.ok(names(x).includes("Shared"));
  assert.match(x.status(), /\\\\BRAVO \(as bravo\)/);
  assert.match(alpha.read("C:\\SYSTEM\\PASSWORD.PWL"), /^BRAVO\|bravo\|sekret$/m);
  alpha.kernel.kill(x.pid);
});

await test("Map Network Drive: Z: is BRAVO's MYFILES, in the tree under My Computer, and there next time", async () => {
  let x = explorer(alpha, "C:\\MYFILES");
  await wait(() => x.title() === "Exploring - Myfiles", "the window");
  x.menu("Map Network Drive...");
  await wait(() => x.dialog("Map Network Drive"), "the dialog");
  const drop = alpha.widgets(x.pid, "DropDown").slice(-1)[0];
  assert.equal(drop.get("Items")[0], "Z:");
  alpha.widgets(x.pid, "TextBox").slice(-1)[0].set("Text", "\\\\bravo\\myfiles");
  alpha.widgets(x.pid, "Button").filter((b) => b.get("Text") === "OK").slice(-1)[0].fire("onClick");
  await wait(() => x.title() === "Exploring - Myfiles on 'Bravo' (Z:)", "Z: " + x.title());
  assert.equal(x.address(), "Z:\\");
  assert.equal(alpha.read("C:\\SYSTEM\\DRIVES.INI"), "Z=\\\\BRAVO\\MYFILES|1\n");
  assert.ok(names(x).some((t) => t.startsWith("Myfiles on 'Bravo")), "in the tree");
  assert.equal(x.dialog("Enter Network Password"), undefined, "the saved password was used");
  alpha.kernel.kill(x.pid);
  // a new window: Z: is there, and goes straight in
  x = explorer(alpha, "Z:\\SHARED");
  await wait(() => x.title() === "Exploring - Shared" && names(x).includes("Readme.txt"), "Z:\\SHARED: " + x.title() + " " + names(x).join(","));
  x.menu("My Computer");
  await wait(() => x.title() === "Exploring - My Computer", "My Computer");
  assert.ok(names(x).includes("Myfiles on 'Bravo' (Z:)"));
  alpha.kernel.kill(x.pid);
});

await test("Copy here, Paste there: a file and a whole folder to BRAVO, and back; Cut moves", async () => {
  const x = explorer(alpha, "C:\\MYFILES");
  await wait(() => x.title() === "Exploring - Myfiles", "the window");
  x.menu("Details");
  await x.idle();
  // Projects (a folder with a folder in it) and NOTES.TXT
  await x.click(0);
  x.menu("Copy");
  await x.idle();
  assert.equal(alpha.read("C:\\SYSTEM\\EXPCLIP.TXT"), "copy\nC:\\MYFILES\\PROJECTS");
  await x.go("Z:\\");
  x.key("Ctrl+V");
  await wait(() => bravo.exists("C:\\MYFILES\\PROJECTS\\SITE\\INDEX.HTM"), "the folder on BRAVO");
  assert.equal(bravo.read("C:\\MYFILES\\PROJECTS\\PLAN.TXT"), "the plan\n");
  // a file from BRAVO, cut, and pasted in a second window here
  await wait(() => names(x).includes("Bravo.txt"), "listed");
  const row = ["Projects", "Shared", "Bravo.txt"].indexOf("Bravo.txt");
  await x.click(row);
  x.menu("Cut");
  await x.idle();
  const y = explorer(alpha, "C:\\MYFILES");
  await wait(() => y.title() === "Exploring - Myfiles", "a second window");
  y.menu("Paste");
  await wait(() => alpha.exists("C:\\MYFILES\\BRAVO.TXT") && !bravo.exists("C:\\MYFILES\\BRAVO.TXT"), "moved from BRAVO to ALPHA");
  assert.equal(alpha.read("C:\\MYFILES\\BRAVO.TXT"), "bravo's own\n");
  assert.equal(alpha.exists("C:\\SYSTEM\\EXPCLIP.TXT"), false, "a cut is pasted once");
  // Undo the move: back to BRAVO
  y.menu("Undo");
  await wait(() => bravo.exists("C:\\MYFILES\\BRAVO.TXT") && !alpha.exists("C:\\MYFILES\\BRAVO.TXT"), "undone");
  alpha.kernel.kill(x.pid);
  alpha.kernel.kill(y.pid);
  assert.deepEqual(alpha.errors, []);
});

await test("drag and drop: onto a folder on the same disk moves; a copy of a file in its own folder is NAME~1", async () => {
  const x = explorer(alpha, "C:\\MYFILES");
  await wait(() => x.title() === "Exploring - Myfiles", "the window");
  x.menu("Details");
  await x.idle();
  // rows: Projects, Notes.txt, Todo.txt
  const c = x.canvas();
  c.fire("onMouseDown", x.rowX(), x.rowY(2), 1);
  c.fire("onMouseMove", x.rowX() + 10, x.rowY(1));
  c.fire("onMouseMove", x.rowX() + 2, x.rowY(0));
  c.fire("onMouseUp", x.rowX() + 2, x.rowY(0), 1);
  await wait(() => alpha.exists("C:\\MYFILES\\PROJECTS\\TODO.TXT") && !alpha.exists("C:\\MYFILES\\TODO.TXT"), "moved into Projects");
  await x.click(1);
  x.menu("Copy");
  x.menu("Paste");
  await wait(() => alpha.exists("C:\\MYFILES\\NOTES~1.TXT"), "the copy");
  assert.equal(alpha.read("C:\\MYFILES\\NOTES~1.TXT"), "my notes\n");
  alpha.kernel.kill(x.pid);
});

await test("the Recycle Bin: Delete sends it there, Undo and Restore bring it back, Empty is for good", async () => {
  const x = explorer(alpha, "C:\\MYFILES");
  await wait(() => x.title() === "Exploring - Myfiles", "the window");
  x.menu("Details");
  await x.idle();
  // rows: Projects, Notes.txt, Notes~1.txt
  await x.click(2);
  alpha.ui.answers.push(true);
  x.key("Delete");
  await wait(() => !alpha.exists("C:\\MYFILES\\NOTES~1.TXT"), "gone");
  assert.match(alpha.ui.dialogs.slice(-1)[0].text, /send 'Notes~1\.txt' to the Recycle Bin\?/);
  assert.match(alpha.read("C:\\RECYCLED\\INFO.TXT"), /^D1\.TXT\|C:\\MYFILES\\NOTES~1\.TXT\|\d+\|9\|F$/m);
  x.key("Ctrl+Z");
  await wait(() => alpha.exists("C:\\MYFILES\\NOTES~1.TXT"), "undone");
  await x.click(2);
  alpha.ui.answers.push(true);
  x.menu("Delete");
  await wait(() => !alpha.exists("C:\\MYFILES\\NOTES~1.TXT"), "gone again");
  x.menu("Recycle Bin");
  await wait(() => x.title() === "Exploring - Recycle Bin", "the bin");
  assert.ok(names(x).includes("Notes~1.txt") && names(x).includes("Original Location") && names(x).includes("C:\\MYFILES"));
  await x.click(0);
  x.menu("Restore");
  await wait(() => alpha.exists("C:\\MYFILES\\NOTES~1.TXT"), "restored");
  // into the bin again, and emptied
  await x.go("C:\\MYFILES");
  await x.click(2);
  alpha.ui.answers.push(true);
  x.menu("Delete");
  await wait(() => !alpha.exists("C:\\MYFILES\\NOTES~1.TXT"), "binned");
  alpha.ui.answers.push(true);
  x.menu("Empty Recycle Bin");
  await wait(() => alpha.read("C:\\RECYCLED\\INFO.TXT") === "" && !alpha.exists("C:\\RECYCLED\\D2.TXT"), "emptied");
  // on BRAVO's disk, deleting is for good, and says so
  await x.go("Z:\\PROJECTS");
  await wait(() => names(x).includes("Plan.txt"), "Z:\\PROJECTS");
  await x.click(1);
  alpha.ui.answers.push(true);
  x.menu("Delete");
  await wait(() => !bravo.exists("C:\\MYFILES\\PROJECTS\\PLAN.TXT"), "deleted on BRAVO");
  assert.match(alpha.ui.dialogs.slice(-1)[0].text, /Are you sure you want to delete 'Plan\.txt'\?[\s\S]*can't be brought back/);
  alpha.kernel.kill(x.pid);
});

await test("New Folder and Rename, typed over the name, here and on BRAVO; bad names refused", async () => {
  const x = explorer(alpha, "Z:\\");
  await wait(() => x.title().startsWith("Exploring - Myfiles on"), "Z:");
  x.menu("Details");
  x.menu("New Folder");
  await wait(() => bravo.exists("C:\\MYFILES\\NEWFOLDR"), "made on BRAVO");
  const ren = alpha.widgets(x.pid, "TextBox")[1];
  await wait(() => ren.get("Visible") === true && ren.get("Text") === "NEWFOLDR", "the name box");
  ren.set("Text", "music");
  ren.fire("onEnter");
  await wait(() => bravo.exists("C:\\MYFILES\\MUSIC") && !bravo.exists("C:\\MYFILES\\NEWFOLDR"), "renamed on BRAVO");
  // F2 on a file here, and a name that won't do
  await x.go("C:\\MYFILES");
  await x.click(1);
  x.key("F2");
  await wait(() => ren.get("Visible") === true, "the name box");
  ren.set("Text", "much too long name.txt");
  ren.fire("onEnter");
  await wait(() => alpha.ui.dialogs.some((d) => /8\.3/.test(d.text)), "refused");
  await x.click(1);
  x.key("F2");
  await wait(() => ren.get("Visible") === true, "the name box again");
  ren.set("Text", "mynotes.txt");
  ren.fire("onEnter");
  await wait(() => alpha.exists("C:\\MYFILES\\MYNOTES.TXT"), "renamed");
  alpha.kernel.kill(x.pid);
});

await test("a file on BRAVO opens in a copy here, and what's saved goes back", async () => {
  const x = explorer(alpha, "Z:\\SHARED");
  await wait(() => names(x).includes("Readme.txt"), "Z:\\SHARED");
  x.menu("Details");
  await x.idle();
  await x.open(0);
  await wait(() => alpha.exists("C:\\SYSTEM\\TEMP\\README.TXT"), "the copy");
  await wait(() => alpha.kernel.ps().some((p) => /NOTES/i.test(p.name || p.path || "")), "Notes open");
  alpha.write("C:\\SYSTEM\\TEMP\\README.TXT", "from bravo, edited on alpha\n");
  await wait(() => bravo.read("C:\\MYFILES\\SHARED\\README.TXT") === "from bravo, edited on alpha\n", "saved back to BRAVO", 10000);
  assert.match(x.status(), /Saved README\.TXT back to \\\\BRAVO/);
  alpha.kernel.kill(x.pid);
});

await test("a machine that isn't there: an error, and Explorer carries on", async () => {
  alpha.write("C:\\SYSTEM\\DRIVES.INI", "Z=\\\\BRAVO\\MYFILES|1\nY=\\\\NOBODY\\|1\n");
  const x = explorer(alpha, "C:\\MYFILES");
  await wait(() => x.title() === "Exploring - Myfiles", "the window");
  await x.go("Y:\\");
  await wait(() => names(x).some((t) => /NOBODY/.test(t)), "the reason, in the window: " + names(x).join("|"), 25000);
  assert.ok(names(x).some((t) => /network path \\\\NOBODY was not found/.test(t)) || names(x).some((t) => /NOBODY/.test(t)));
  // still going
  await x.go("C:\\MYFILES\\PROJECTS");
  await wait(() => x.title() === "Exploring - Projects", "on we go");
  // and the dialog way
  x.menu("Map Network Drive...");
  await wait(() => x.dialog("Map Network Drive"), "the dialog");
  alpha.widgets(x.pid, "TextBox").slice(-1)[0].set("Text", "\\\\NOBODY\\DOCS");
  alpha.widgets(x.pid, "Button").filter((b) => b.get("Text") === "OK").slice(-1)[0].fire("onClick");
  await wait(() => alpha.ui.dialogs.some((d) => /NOBODY/.test(d.text)), "an error", 25000);
  assert.ok(alpha.running(x.pid));
  assert.deepEqual(alpha.errors, []);
  alpha.write("C:\\SYSTEM\\DRIVES.INI", "Z=\\\\BRAVO\\MYFILES|1\n");
  alpha.kernel.kill(x.pid);
});

await test("Network Neighborhood, Find, Disconnect, and the views", async () => {
  const x = explorer(alpha, "::NETWORK");
  await wait(() => x.title() === "Exploring - Network Neighborhood" && names(x).includes("Bravo"), "the machines: " + names(x).join(","));
  assert.ok(names(x).includes("Alpha"));
  for (const v of ["Large Icons", "Small Icons", "List", "Details"]) {
    x.menu(v);
    await x.idle(200);
    assert.ok(names(x).includes("Bravo"), v);
  }
  // Find: *.TXT in C:\MYFILES
  x.menu("Find...");
  await wait(() => x.dialog("Find: All Files"), "Find");
  const tbs = alpha.widgets(x.pid, "TextBox");
  tbs[tbs.length - 2].set("Text", "*.TXT");
  alpha.widgets(x.pid, "DropDown").slice(-1)[0].set("Selected", 2);
  alpha.widgets(x.pid, "Button").filter((b) => b.get("Text") === "Find Now").slice(-1)[0].fire("onClick");
  await wait(() => x.title() === "Exploring - Search Results", "results");
  assert.ok(names(x).includes("Mynotes.txt") && names(x).includes("Todo.txt") && names(x).includes("In Folder"), names(x).join(","));
  assert.match(x.status(), /file\(s\) found in C:\\MYFILES/);
  // Disconnect Z:
  x.menu("Disconnect Network Drive...");
  await wait(() => x.dialog("Disconnect Network Drive"), "the dialog");
  alpha.widgets(x.pid, "Button").filter((b) => b.get("Text") === "OK").slice(-1)[0].fire("onClick");
  await wait(() => alpha.read("C:\\SYSTEM\\DRIVES.INI").trim() === "", "gone from DRIVES.INI");
  alpha.kernel.kill(x.pid);
  assert.deepEqual(alpha.errors, []);
  assert.deepEqual(bravo.errors, []);
});

net.shutdown();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
