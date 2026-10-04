// Tests for Visual SPARK (vspark/): the form designer, properties, the code
// window and its templates, saving, reopening and running. The IDE is driven
// the way a person would: dragging on the designer canvas, picking from lists,
// typing into boxes.
//   node tools/aspsim/vspark.test.mjs
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
const dev = await net.boot("DEV");
const wait = (fn, what, ms = 15000) => net.until(fn, ms, what);
const proc = (name) => dev.kernel.ps().find((p) => p.name === name)?.pid;
const CX = 12, CY = 32; // the form's client area on the designer canvas

// Visual SPARK's window, by its controls
const ide = {
  pid: () => proc("VSPARK"),
  w: (type, n = 0) => dev.widgets(ide.pid(), type)[n],
  win: () => ide.w("Window"),
  status: () => String(ide.win().get("Status")),
  toolbox: () => ide.w("ListBox", 0),
  props: () => ide.w("ListBox", 1),
  propObj: () => ide.w("DropDown", 2),
  objList: () => ide.w("DropDown", 0),
  evtList: () => ide.w("DropDown", 1),
  propEdit: () => ide.w("TextBox", 0),
  design: () => ide.w("Canvas", 0),
  editor: () => ide.w("TextArea", 0),
  code: () => String(ide.editor().get("Text")),
  menu: (item) => ide.w("Menu").fire("onSelect", item),
  ctx: () => ide.w("Menu", 1),
  keys: () => dev.widgets(ide.pid(), "Button").find((b) => b.get("Width") === 1),
  propDel: () => dev.widgets(ide.pid(), "Button").find((b) => b.get("Text") === "&Delete"),
  drawn: () => (ide.design().ops || []).filter((o) => o[0] === "Text").map((o) => o[3]),
  prop: (key) => (ide.props().get("Items").find((l) => l.startsWith(key.padEnd(11))) ?? "").slice(11),
  pick(list, i) { list.set("Selected", i); list.fire("onSelect"); },
  async tool(name) { const t = ide.toolbox(); ide.pick(t, t.get("Items").indexOf(name)); await sleep(50); },
  async drag(x0, y0, x1, y1) {
    const d = ide.design();
    d.fire("onMouseDown", CX + x0, CY + y0, 1);
    await sleep(30);
    d.fire("onMouseMove", CX + x1, CY + y1);
    await sleep(30);
    d.fire("onMouseUp", CX + x1, CY + y1, 1);
    await sleep(100);
  },
  async click(x, y) { const d = ide.design(); d.fire("onMouseDown", CX + x, CY + y, 1); await sleep(20); d.fire("onMouseUp", CX + x, CY + y, 1); await sleep(30); },
  async select(name) {
    const i = ide.propObj().get("Items").findIndex((s) => s.startsWith(name + " "));
    assert.ok(i >= 0, name + " in the object list: " + ide.propObj().get("Items"));
    ide.pick(ide.propObj(), i);
    await wait(() => ide.prop("Name") === name, name + " selected");
  },
  async set(key, value) {
    const i = ide.props().get("Items").findIndex((l) => l.startsWith(key.padEnd(11)));
    assert.ok(i >= 0, key + " in the properties: " + ide.props().get("Items"));
    ide.pick(ide.props(), i);
    await sleep(30);
    ide.propEdit().set("Text", value);
    ide.propEdit().fire("onEnter");
    await sleep(80);
  },
  async toggle(key) {
    const i = ide.props().get("Items").findIndex((l) => l.startsWith(key.padEnd(11)));
    ide.pick(ide.props(), i);
    ide.props().fire("onDblClick");
    await sleep(80);
  },
};
const said = () => dev.ui.dialogs.splice(0).map((d) => d.text).join("\n---\n");
const errorsOf = (name) => dev.ui.dialogs.filter((d) => d.kind === "error" || /did not compile|Runtime error/.test(d.text)).map((d) => d.text).join("\n") || "";

await test("the installer puts Visual SPARK and its templates on the machine, and starts it; Vapor can sell it", async () => {
  const installer = fs.readFileSync(path.join(root, "vspark/INSTALL.SPK"), "utf8");
  assert.match(installer, /^' VAPOR\|id=VSPARK\|name=Visual SPARK\|kind=program\|version=[0-9a-f]{8}\|category=Programming\|/);
  dev.write("C:\\MYFILES\\INSTALL.SPK", installer);
  const pid = dev.run("C:\\MYFILES\\INSTALL.SPK");
  await wait(() => ide.pid(), "Visual SPARK running", 30000);
  assert.match(dev.output(pid), /Visual SPARK is installed/);
  for (const f of ["INDEX.TXT", "EMPTY.SPK", "HELLO.SPK", "COUNTER.SPK", "PAINT.SPK", "CHAT.SPK", "GAME.SPK"]) assert.ok(dev.exists("C:\\VSPARK\\TEMPLATE\\" + f), f);
  await wait(() => /^Visual SPARK - PROJECT1\.SPK$/.test(ide.win()?.get("Title")), "the window").catch((e) => { throw new Error(e.message + " | ps: " + JSON.stringify(dev.kernel.ps()) + " | widgets: " + dev.widgets(ide.pid()).map((w) => w.type) + " | dialogs: " + JSON.stringify(dev.ui.dialogs)); });
  assert.match(ide.code(), /SUB Main \(\)\n    InitForm\(\)\n    Form1\.Show\(\)\nEND SUB\n$/);
  assert.equal(ide.prop("Name"), "Form1");
  assert.ok(ide.drawn().includes("Form1"), "the form drawn, with its title");
  assert.deepEqual(errorsOf(), "");
});

await test("the toolbox: drag a Button onto the form; double-click to drop a Label and a TextBox", async () => {
  await ide.tool("Button");
  await ide.drag(16, 48, 96, 72);
  await wait(() => ide.prop("Name") === "Command1", "Command1 made: " + ide.props().get("Items"));
  assert.equal(ide.prop("X"), "16");
  assert.equal(ide.prop("Y"), "48");
  assert.equal(ide.prop("Width"), "80");
  assert.equal(ide.prop("Height"), "24");
  assert.equal(ide.prop("Text"), "Command1");
  assert.equal(ide.toolbox().get("Selected"), 0, "back to the pointer");
  assert.ok(ide.drawn().includes("Command1"), "drawn on the form");
  ide.pick(ide.toolbox(), ide.toolbox().get("Items").indexOf("Label"));
  ide.toolbox().fire("onDblClick");
  await wait(() => ide.prop("Name") === "Label1", "Label1 dropped");
  ide.pick(ide.toolbox(), ide.toolbox().get("Items").indexOf("TextBox"));
  ide.toolbox().fire("onDblClick");
  await wait(() => ide.prop("Name") === "Text1", "Text1 dropped");
  assert.deepEqual(ide.propObj().get("Items"), ["Form1  (Form)", "Command1  (Button)", "Label1  (Label)", "Text1  (TextBox)"]);
});

await test("the designer: drag to move, the corner handle to size, Delete to remove", async () => {
  await ide.select("Text1");
  const x = +ide.prop("X"), y = +ide.prop("Y");
  await ide.drag(x + 10, y + 10, 16 + 10, 16 + 10);
  await wait(() => ide.prop("X") === "16" && ide.prop("Y") === "16", "moved: " + ide.prop("X") + "," + ide.prop("Y"));
  await ide.drag(16 + 120, 16 + 24, 16 + 200, 16 + 24);
  await wait(() => ide.prop("Width") === "200", "sized: " + ide.prop("Width"));
  // (one to throw away)
  await ide.tool("CheckBox");
  await ide.drag(200, 120, 200, 120);
  await wait(() => ide.prop("Name") === "Check1", "Check1");
  // (a Canvas gets no keys: the designer's go to a button too small to see)
  ide.keys().fire("onKey", "Delete");
  await wait(() => !ide.propObj().get("Items").some((s) => s.startsWith("Check1")), "Check1 deleted");
  assert.equal(ide.prop("Name"), "Form1");
  assert.equal(ide.propDel().get("Enabled"), false, "the form can't be deleted");
});

await test("deleting a control: the Delete button, Edit > Delete Control, and the right-click menu", async () => {
  const has = (name) => ide.propObj().get("Items").some((s) => s.startsWith(name + " "));
  for (const [x, y] of [[200, 100], [200, 140], [200, 180]]) {
    await ide.tool("CheckBox");
    await ide.drag(x, y, x, y);
  }
  await wait(() => has("Check3"), "three check boxes");
  await ide.select("Check1");
  assert.equal(ide.propDel().get("Enabled"), true);
  ide.propDel().fire("onClick");
  await wait(() => !has("Check1"), "Check1 deleted by the button");
  await ide.select("Check2");
  ide.menu("Delete Control");
  await wait(() => !has("Check2"), "Check2 deleted from the menu");
  ide.menu("Delete Control");
  await wait(() => /Select a control/.test(ide.status()), "nothing to delete: " + ide.status());
  assert.ok(has("Form1"), "the form stays");
  // a right click selects what's under it, then its menu deletes it
  ide.design().fire("onMouseDown", CX + 205, CY + 185, 2);
  await wait(() => ide.prop("Name") === "Check3", "Check3 selected by the right click");
  ide.design().fire("onMouseUp", CX + 205, CY + 185, 2);
  ide.ctx().fire("onSelect", "Delete");
  await wait(() => !has("Check3"), "Check3 deleted from its menu");
  assert.deepEqual(ide.propObj().get("Items"), ["Form1  (Form)", "Command1  (Button)", "Label1  (Label)", "Text1  (TextBox)"]);
});

await test("properties: type a value and press Enter; double-click switches TRUE/FALSE; bad names are refused", async () => {
  await ide.select("Form1");
  await ide.set("Title", "Greeter");
  await ide.set("Width", "240");
  await ide.set("Height", "120");
  assert.equal(ide.prop("Title"), "Greeter");
  assert.ok(ide.drawn().includes("Greeter"));
  await ide.select("Label1");
  await ide.set("Text", "Type your name, then Greet.");
  await ide.set("Width", "224");
  await ide.set("X", "16");
  await ide.set("Y", "48");
  await ide.select("Command1");
  await ide.set("Text", "&Greet");
  await ide.set("Y", "80");
  await ide.toggle("Default");
  assert.equal(ide.prop("Default"), "TRUE");
  await ide.set("Name", "2bad");
  assert.match(said(), /can't be a name/);
  await ide.set("Name", "Label1");
  assert.match(said(), /Something else is already called Label1/);
  assert.equal(ide.prop("Name"), "Command1");
});

await test("double-clicking a control writes its event's SUB from a template, and goes to it", async () => {
  await ide.select("Command1");
  await ide.click(20, 84);
  await ide.click(20, 84);
  await wait(() => ide.editor().get("Visible") !== false && /SUB Command1_OnClick \(\)/.test(ide.code()), "the handler: " + ide.code());
  assert.match(ide.code(), /SUB Command1_OnClick \(\)\n    ' when Command1 is clicked\. For example:\n    ' Form1\.Title = "Clicked!"\nEND SUB\n$/);
  assert.equal(ide.design().get("Visible"), false, "the code window instead of the form");
  const bodyLine = () => ide.code().split("\n").indexOf("SUB Command1_OnClick ()") + 2;
  assert.equal(ide.editor().get("Line"), bodyLine(), "the cursor in the new SUB");
  assert.ok(ide.evtList().get("Items").includes("onClick  (code)"));
  // the code dropdowns: Text1's onEnter, written the same way
  ide.pick(ide.objList(), ide.objList().get("Items").indexOf("Text1  (TextBox)"));
  await sleep(50);
  ide.pick(ide.evtList(), ide.evtList().get("Items").indexOf("onEnter"));
  await wait(() => /SUB Text1_OnEnter \(\)/.test(ide.code()), "Text1_OnEnter");
  // and picking one that's there goes to it, without writing another
  ide.pick(ide.objList(), ide.objList().get("Items").indexOf("Command1  (Button)"));
  await sleep(50);
  ide.pick(ide.evtList(), 0);
  await sleep(100);
  assert.equal(ide.code().match(/SUB Command1_OnClick/g).length, 1);
  assert.equal(ide.editor().get("Line"), bodyLine());
});

await test("save as, then run: the program works, with its events joined up", async () => {
  // what happens: Enter in the box or a click on Greet says hello
  ide.editor().set("Text", ide.code()
    .replace(/    ' when Command1 is clicked\. For example:\n    ' Form1\.Title = "Clicked!"/, '    Label1.Text = "Hello, " + Text1.Text + "!"')
    .replace(/(SUB Text1_OnEnter \(\)\n)[\s\S]*?(END SUB)/, "$1    Command1_OnClick()\n$2"));
  dev.ui.files.push("C:\\MYFILES\\GREET");
  ide.menu("Save Project As...");
  await wait(() => dev.exists("C:\\MYFILES\\GREET.SPK"), "saved");
  assert.equal(dev.ui.fileDialogs.at(-1).mode, "save");
  assert.equal(ide.win().get("Title"), "Visual SPARK - GREET.SPK");
  const file = dev.read("C:\\MYFILES\\GREET.SPK");
  assert.match(file, /^' PROJECT1\.SPK - made with Visual SPARK/, "your code first");
  assert.match(file, /\n' ===== Visual SPARK form: the designer writes everything from here to END OF FORM\. =====\n' FORM Form\|Name=Form1\|Title=Greeter\|Width=240\|Height=120\|/);
  assert.match(file, /\n' CTRL Button\|Name=Command1\|Text=&Greet\|X=16\|Y=80\|Width=80\|Height=24\|Visible=TRUE\|Enabled=TRUE\|Default=TRUE\|Cancel=FALSE\n/);
  assert.match(file, /\nVAR Command1 AS GUI_Button\n/);
  assert.match(file, /\n    Form1 = GUI_Window\.New\("Greeter", 240, 120\)\n/);
  assert.match(file, /\n    Command1\.SetBounds\(16, 80, 80, 24\)\n    Command1\.Text = "&Greet"\n    Command1\.Default = TRUE\n    Command1\.onClick = Command1_OnClick\n/);
  assert.match(file, /\n    Text1\.onEnter = Text1_OnEnter\n/);
  assert.ok(!/Label1\.on/.test(file), "no SUB, no joining");
  assert.match(file, /\n' ===== END OF FORM =====\n$/);
  ide.menu("Start");
  await wait(() => proc("GREET") && dev.widgets(proc("GREET"), "Window")[0]?.get("Visible"), "GREET running: " + errorsOf(), 20000);
  const g = proc("GREET");
  assert.equal(dev.widgets(g, "Window")[0].get("Title"), "Greeter");
  dev.widgets(g, "TextBox")[0].set("Text", "Ann");
  dev.widgets(g, "Button")[0].call("Click");
  await wait(() => dev.widgets(g, "Label")[0].get("Text") === "Hello, Ann!", "the label: " + dev.widgets(g, "Label")[0].get("Text"));
  dev.widgets(g, "TextBox")[0].set("Text", "Bob");
  dev.widgets(g, "TextBox")[0].fire("onEnter");
  await wait(() => dev.widgets(g, "Label")[0].get("Text") === "Hello, Bob!", "Enter too");
  assert.equal(errorsOf(), "");
  // Run again: the old one is ended first
  ide.menu("Start");
  await wait(() => proc("GREET") && proc("GREET") !== g, "run again");
  assert.ok(!dev.kernel.ps().some((p) => p.pid === g), "the first run ended");
  ide.menu("End");
  await wait(() => !proc("GREET"), "ended");
});

await test("the saved file runs on its own, without Visual SPARK", async () => {
  const pid = dev.run("C:\\MYFILES\\GREET.SPK");
  await wait(() => dev.widgets(pid, "Window")[0]?.get("Visible"), "running on its own");
  dev.widgets(pid, "Button")[0].call("Click");
  await wait(() => dev.widgets(pid, "Label")[0].get("Text") === "Hello, !", "it works");
  dev.kernel.kill(pid);
});

await test("open it again: the designer has the form back, and the code is as it was", async () => {
  const code = ide.code();
  ide.menu("New Project...");
  await wait(() => dev.widgets(ide.pid(), "Window").length === 2, "the New Project window");
  dev.widgets(ide.pid(), "Button").find((b) => b.get("Text") === "OK").call("Click");
  await wait(() => ide.propObj().get("Items").length === 1, "an empty form");
  dev.ui.files.push("C:\\MYFILES\\GREET.SPK");
  ide.menu("Open Project...");
  await wait(() => ide.win().get("Title") === "Visual SPARK - GREET.SPK", "opened");
  assert.deepEqual(ide.propObj().get("Items"), ["Form1  (Form)", "Command1  (Button)", "Label1  (Label)", "Text1  (TextBox)"]);
  await ide.select("Command1");
  assert.equal(ide.prop("Text"), "&Greet");
  assert.equal(ide.prop("Default"), "TRUE");
  assert.equal(ide.code(), code.replace(/\n*$/, "\n"));
  assert.ok(ide.drawn().includes("Greeter"));
});

await test("renaming a control renames it in the code too, and it still runs", async () => {
  await ide.select("Command1");
  await ide.set("Name", "GreetBtn");
  assert.match(ide.code(), /SUB GreetBtn_OnClick \(\)/);
  assert.match(ide.code(), /    GreetBtn_OnClick\(\)\n/);
  assert.ok(!/Command1/.test(ide.code()));
  assert.equal(ide.code().split("the designer looks after it").length, 2, "nothing doubled: " + ide.code());
  ide.menu("Save Project");
  await wait(() => /GreetBtn\.onClick = GreetBtn_OnClick/.test(dev.read("C:\\MYFILES\\GREET.SPK")), "saved");
  ide.menu("Start");
  await wait(() => proc("GREET"), "running");
  const g = proc("GREET");
  await wait(() => dev.widgets(g, "Button")[0], "its button");
  dev.widgets(g, "Button")[0].call("Click");
  await wait(() => dev.widgets(g, "Label")[0].get("Text") === "Hello, !", "renamed and working");
  ide.menu("End");
  assert.equal(errorsOf(), "");
});

await test("Insert: a message box at the cursor, and it runs", async () => {
  ide.menu("Code");
  const lines = ide.code().split("\n");
  ide.editor().call("GotoLine", lines.indexOf("SUB GreetBtn_OnClick ()") + 2);
  ide.menu("Message Box");
  await wait(() => /    VAR box AS GUI_MessageBox\n    box = GUI_MessageBox\.New\(Form1\)/.test(ide.code()), "inserted: " + ide.code());
  ide.menu("Start");
  await wait(() => proc("GREET") && dev.widgets(proc("GREET"), "Button")[0], "running");
  dev.ui.dialogs.splice(0);
  dev.widgets(proc("GREET"), "Button")[0].call("Click");
  await wait(() => dev.ui.dialogs.some((d) => d.text === "Hello from Visual SPARK!"), "the message box: " + JSON.stringify(dev.ui.dialogs));
  dev.ui.dialogs.splice(0);
  ide.menu("End");
});

await test("every template makes a program that compiles and starts", async () => {
  const index = dev.read("C:\\VSPARK\\TEMPLATE\\INDEX.TXT").trim().split("\n").map((l) => l.split("|"));
  assert.deepEqual(index.map((l) => l[1]), ["Empty form", "Hello, world", "Counter", "Paint", "Chat client", "Vapor game"]);
  const titles = { "Empty form": "Form1", "Hello, world": "Hello", Counter: "Counter", Paint: "Paint", "Chat client": "Chat", "Vapor game": "My Game" };
  for (let k = 0; k < index.length; k++) {
    dev.ui.answers.push(true); // throw away the changes
    ide.menu("New Project...");
    await wait(() => dev.widgets(ide.pid(), "Window").length === 2, "the New Project window");
    const list = dev.widgets(ide.pid(), "ListBox")[2];
    ide.pick(list, k);
    dev.widgets(ide.pid(), "Button").find((b) => b.get("Text") === "OK").call("Click");
    await wait(() => dev.widgets(ide.pid(), "Window").length === 1 && ide.win().get("Title") === "Visual SPARK - PROJECT1.SPK", index[k][1]);
    dev.ui.dialogs.splice(0);
    ide.menu("Start");
    await wait(() => proc("RUN") && dev.widgets(proc("RUN"), "Window")[0]?.get("Visible"), index[k][1] + " running: " + errorsOf(), 20000);
    assert.equal(dev.widgets(proc("RUN"), "Window")[0].get("Title"), titles[index[k][1]], index[k][1]);
    await sleep(300);
    assert.equal(errorsOf(), "", index[k][1]);
    ide.menu("End");
    await wait(() => !proc("RUN"), "ended");
  }
});

await test("the Counter template counts; the Vapor game's file is a Vapor item", async () => {
  dev.ui.answers.push(true);
  ide.menu("New Project...");
  await wait(() => dev.widgets(ide.pid(), "Window").length === 2, "New Project");
  ide.pick(dev.widgets(ide.pid(), "ListBox")[2], 2);
  dev.widgets(ide.pid(), "Button").find((b) => b.get("Text") === "OK").call("Click");
  await wait(() => ide.propObj().get("Items").includes("Timer1  (Timer)"), "Counter loaded");
  ide.menu("Start");
  await wait(() => proc("RUN") && dev.widgets(proc("RUN"), "Label")[0], "running");
  await wait(() => /^[1-9]\d* seconds$/.test(dev.widgets(proc("RUN"), "Label")[0].get("Text")), "counting: " + dev.widgets(proc("RUN"), "Label")[0]?.get("Text"), 5000);
  ide.menu("End");
  const game = dev.read("C:\\VSPARK\\TEMPLATE\\GAME.SPK");
  assert.match(game.split("\n")[0], /^' VAPOR\|id=MYGAME\|name=My Game\|kind=game\|version=1\|/);
});

await test("closing with changes asks to save first", async () => {
  await ide.tool("Button");
  await ide.drag(8, 8, 8, 8);
  dev.ui.dialogs.splice(0);
  dev.ui.answers.push(false);
  const pid = ide.pid();
  ide.win().call("Close");
  await wait(() => !dev.kernel.ps().some((p) => p.pid === pid), "closed");
  assert.match(said(), /^Save the changes to PROJECT1\.SPK before closing\?$/);
  assert.deepEqual(dev.errors, []);
});

net.shutdown();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
