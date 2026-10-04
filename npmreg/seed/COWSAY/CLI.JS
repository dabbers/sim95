// cowsay hello there   (-e eyes, -T tongue, -d dead, -b borg)
const cowsay = require("./INDEX.JS");
const args = process.argv.slice(2);
const o = { text: "" };
const words = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "-e") o.eyes = args[++i];
  else if (a === "-T") o.tongue = args[++i];
  else if (a === "-d") { o.eyes = "xx"; o.tongue = "U "; }
  else if (a === "-b") o.eyes = "==";
  else words.push(a);
}
o.text = words.join(" ") || "Moo. (Try: cowsay hello)";
console.log(cowsay.say(o));
