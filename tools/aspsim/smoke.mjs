import { machine, browser } from "./sim.mjs";
const m = await machine();
const b = browser(m);
let r = await b.get("/hello.asp");
console.log(r.status, r.body.slice(0, 300));
r = await b.post("/hello.asp", { name: "Ann <b>" });
console.log(b.cookies(), r.body.includes("Ann &lt;b&gt;"));
console.log(await m.runScript('SUB Main ()\nVAR i AS Integer\nFOR i = 3 TO 1 STEP -1\nPrint(Str(i))\nNEXT\nPrint(Str(2147483647 * 31 MOD 1000))\nEND SUB'));
process.exit(0);
