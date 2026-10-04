// ==UserScript==
// @name         SIM95 bridge (keeps STARTHERE up to date from GitHub)
// @namespace    https://github.com/dabbers/sim95
// @version      2
// @description  Runs tools/bridge-resident.js in the SIM95 tab of the machine named below: it brings the newest apps from GitHub every 15 minutes, and when asked from Sim Shell (bridge update), over ssh too.
// @match        https://sim95.kippy.io/*
// @run-at       document-idle
// @grant        none
// @sandbox      raw
// @inject-into  page
// ==/UserScript==
//
// Install: in Tampermonkey (or Violentmonkey), Create a new script, paste this
// whole file over it, and save. Then open (or reload) SIM95 in that browser and
// leave the tab open. Once the machine named in MACHINE is at its desktop, the
// bridge starts; the console (F12) shows what it does, and so does
// "bridge status" in Sim Shell on that machine.
//
// This file only finds the machine and loads the bridge itself from GitHub
// (tools/bridge-resident.js, from main), so the bridge stays up to date: a
// newer one runs next time the tab loads.
(function () {
  "use strict";
  // The machine to keep up to date: its name, or the first part of it. ""
  // for whichever machine runs in this browser.
  const MACHINE = "STARTHERE";
  // Where the bridge itself comes from: main, or the branch it's on until
  // that's merged (then also "bridge follow BRANCH" in Sim Shell).
  const BRANCH = "main";
  const FROM = `https://raw.githubusercontent.com/dabbers/sim95/${BRANCH}/tools/bridge-resident.js`;

  function findMachine() {
    for (const el of document.querySelectorAll("body *")) {
      const key = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
      if (!key) continue;
      for (let f = el[key]; f; f = f.return) {
        const m = f.memoizedProps && f.memoizedProps.machine;
        if (m && m.fs && typeof m.fs.write === "function" && m.kernel) return m;
      }
    }
    return null;
  }

  let tries = 0;
  const look = setInterval(async () => {
    const m = findMachine();
    tries++;
    if (!m) return; // not at the desktop yet (setup, or booting)
    clearInterval(look);
    const name = String((m.hostname && m.hostname()) || (m.net && m.net.hostname && m.net.hostname()) || "").toUpperCase();
    if (MACHINE && name !== MACHINE && name.split(".")[0] !== MACHINE) {
      console.log(`SIM95 bridge: this machine is ${name}, not ${MACHINE}, so the bridge isn't started here.`);
      return;
    }
    try {
      const r = await fetch(FROM + "?t=" + Date.now());
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      const code = await r.text();
      globalThis.SIM95_RESIDENT = { machine: m };
      await (0, eval)(code);
    } catch (e) {
      console.error("SIM95 bridge: couldn't start:", e);
    }
  }, 3000);
})();
