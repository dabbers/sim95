// wrap(text, width): an array of lines, none longer than width (unless one word is)
function wrap(text, width) {
  width = width || 40;
  const lines = [];
  for (const para of String(text).split("\n")) {
    let line = "";
    for (const word of para.split(" ")) {
      if (word === "") continue;
      if (line === "") line = word;
      else if (line.length + 1 + word.length <= width) line += " " + word;
      else { lines.push(line); line = word; }
    }
    lines.push(line);
  }
  return lines;
}
module.exports = wrap;
module.exports.text = (text, width) => wrap(text, width).join("\n");
