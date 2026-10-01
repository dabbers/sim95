// What C:\PROGRAMS\SIMXPLOR.SPK is: the JavaScript engine, the browser, the
// SimDNS resolver (simdns/src/RESOLVE.SPK, whose names all start with Rs), and
// a copy of SimPlayer (simplayer/src/PLAYER.SPK) built in, so movies play in a
// window of the browser's own without a separate download.
//
// SPARK has one namespace per program, and the player's names (win, state,
// StartFetch, Refresh...) are the browser's names too. So every top-level name
// of the player - its VARs, CONSTs, SUBs and FUNCTIONs - becomes Mv<name>
// here, everywhere it is used: not inside strings or comments, and not after
// a dot (a property). The browser starts it with MvOpenPlayer(url, TRUE).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

// The SimDNS resolver's names (Rs...) are never renamed: the player in the
// browser uses the browser's own copy of the resolver (one cache, one
// question at a time), so the resolver is joined on once, and only the
// player on its own (withResolver, below) gets a copy of it.
export function embedPlayer(src = read("simplayer/src/PLAYER.SPK")) {
  const names = new Set();
  for (const m of src.matchAll(/^(?:VAR|CONST|SUB|FUNCTION)\s+([A-Za-z_]\w*)/gim)) if (!/^rs/i.test(m[1])) names.add(m[1].toLowerCase());
  let out = "";
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '"') {
      // a string: "" inside it is a quote
      let j = i + 1;
      while (j < src.length && !(src[j] === '"' && src[j + 1] !== '"')) j += src[j] === '"' ? 2 : 1;
      out += src.slice(i, j + 1);
      i = j + 1;
    } else if (c === "'") {
      const j = src.indexOf("\n", i);
      const end = j < 0 ? src.length : j;
      out += src.slice(i, end);
      i = end;
    } else if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /\w/.test(src[j])) j++;
      const word = src.slice(i, j);
      const afterDot = out.trimEnd().endsWith(".") && /\.\s*$/.test(out);
      out += !afterDot && names.has(word.toLowerCase()) ? "Mv" + word : word;
      i = j;
    } else {
      out += c;
      i++;
    }
  }
  return "' ================================================================ SimPlayer, built in\n" + out;
}

// A program with the SimDNS resolver joined on the end, as every program that
// looks names up gets it (SimPlayer, Vapor, Frostbird, MAILD, the Sim Shell,
// AskSim's crawler, DIG).
export const withResolver = (text) => text + "\n" + read("simdns/src/RESOLVE.SPK");

export const simxplorerSource = () => read("simxplorer/src/JSCRIPT.SPK") + "\n" + read("simxplorer/src/BROWSER.SPK") + "\n" + read("simdns/src/RESOLVE.SPK") + "\n" + embedPlayer();
