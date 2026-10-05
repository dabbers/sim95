// WALL.JS - the Pixel Wall in Simxplorer. INDEX.ASP sends it with the state
// of the wall in S, and runs it with eval(CODE).
//
// Simxplorer can change a page's text, but not its colours. So when the wall
// changes, this writes the whole page again with document.write: the new
// page carries S and this code along, and draws itself. Pixels are placed,
// and parts of the wall visited, with XMLHttpRequest; every few seconds it
// asks DATA.ASP whether anyone else has placed one.

var HEX = "0123456789ABCDEF";
var PAL = ["#000000", "#800000", "#008000", "#808000", "#000080", "#800080", "#008080", "#C0C0C0",
           "#808080", "#FF0000", "#00FF00", "#FFFF00", "#0000FF", "#FF00FF", "#00FFFF", "#FFFFFF"];
var NAMES = ["Black", "Maroon", "Green", "Olive", "Navy", "Purple", "Teal", "Silver",
             "Gray", "Red", "Lime", "Yellow", "Blue", "Magenta", "Cyan", "White"];
var busy = false;

function now() { return new Date().getTime(); }
if (S.left > 0) { S.due = now() + S.left * 1000; }
S.left = 0;

function dark(k) { return k == 0 || k == 1 || k == 4 || k == 5 || k == 8 || k == 12; }
function label(r) { return "ABCD".charAt(Math.floor(r / 4)) + (r % 4 + 1); }
function plain(s) { return s.split("&").join("&amp;").split("<").join("&lt;"); }

function coolText() {
  var left = Math.ceil((S.due - now()) / 1000);
  if (left > 0) return "Next pixel in " + left + " seconds";
  return "Ready: click a square";
}

function squares() {
  var ox = (S.r % 4) * 16, oy = Math.floor(S.r / 4) * 16;
  var h = "<table cellspacing=1 cellpadding=0 border=0 bgcolor=#808080>";
  for (var y = 0; y < 16; y++) {
    h += "<tr>";
    for (var x = 0; x < 16; x++) {
      var k = HEX.indexOf(S.rows.charAt(y * 16 + x));
      h += "<td bgcolor=" + PAL[k] + " width=20 height=20 onclick=\"put(" + (ox + x) + "," + (oy + y) + ")\"><tt>&nbsp;&nbsp;</tt></td>";
    }
    h += "</tr>";
  }
  return h + "</table>";
}

function body() {
  var h = "<center><font size=5><b>The Pixel Wall</b></font><br><font size=2>Everyone on the network shares this wall. Pick a colour, then click a square: one pixel every " + S.cool + " seconds.</font>";
  h += "<p><table cellspacing=10 border=0><tr><td valign=top>" + squares() + "</td><td valign=top>";
  h += "<b>The whole wall</b><br><img src=\"wall.asp?v=" + S.v + "\" width=128 height=128 alt=\"the wall\"><br>";
  h += "<font size=2>Go to another part:</font><br><table cellspacing=1 cellpadding=0 border=0 bgcolor=#808080>";
  for (var r = 0; r < 16; r++) {
    if (r % 4 == 0) h += "<tr>";
    if (r == S.r) h += "<td width=32 height=20 align=center bgcolor=#000080><font size=2 color=#FFFFFF><b>" + label(r) + "</b></font></td>";
    else h += "<td width=32 height=20 align=center bgcolor=#FFFFFF onclick=\"go(" + r + ")\"><font size=2 color=#000080>" + label(r) + "</font></td>";
    if (r % 4 == 3) h += "</tr>";
  }
  h += "</table><p><b>Colour:</b> " + NAMES[S.c] + "<br><table cellspacing=1 cellpadding=0 border=0 bgcolor=#808080>";
  for (var k = 0; k < 16; k++) {
    if (k % 8 == 0) h += "<tr>";
    // (the colour in use has a dot in it: S0.PIC to SF.PIC)
    var mark = "<tt>&nbsp;&nbsp;</tt>";
    if (k == S.c) mark = "<img src=\"s" + HEX.charAt(k) + ".pic\" width=20 height=20 alt=\"\">";
    h += "<td bgcolor=" + PAL[k] + " width=20 height=20 onclick=\"pick(" + k + ")\">" + mark + "</td>";
    if (k % 8 == 7) h += "</tr>";
  }
  h += "</table><p><b><span id=cd>" + coolText() + "</span></b><br><font size=2><span id=msg>" + plain(S.msg) + "</span></font>";
  h += "<p><b>Latest pixels</b><br><font size=2>" + plain(S.feed).split("\n").join("<br>") + "</font>";
  h += "</td></tr></table><p><font size=2>Live: other people's pixels appear by themselves. ";
  h += "<a href=\"index.asp?r=" + S.r + "&c=" + S.c + "&plain=1\">Plain version</a></font></center>";
  return h;
}

// S, written out as JavaScript for the next page
function saved() {
  return "{r:" + S.r + ",c:" + S.c + ",v:" + S.v + ",cool:" + S.cool + ",part:" + S.part + ",rows:\"" + S.rows + "\",due:" + S.due +
    ",left:0,feed:unescape(\"" + escape(S.feed) + "\"),msg:unescape(\"" + escape(S.msg) + "\")}";
}

function redraw() {
  document.write("<html><head><title>The Pixel Wall</title></head><body bgcolor=#C0C0C0><script language=\"JavaScript\">var S = " +
    saved() + "; var CODE = unescape(\"" + escape(CODE) + "\"); eval(CODE);</" + "script></body></html>");
}

function say(text) {
  S.msg = text;
  document.getElementById("msg").innerText = text;
}

// What DATA.ASP and PLACE.ASP answer: version, seconds to wait, the region's
// digits, then the latest pixels. True when the page needs drawing again.
function take(lines) {
  var v = parseInt(lines[0]), left = parseInt(lines[1]), feed = lines.slice(3).join("\n");
  var changed = v != S.v || lines[2] != S.rows || feed != S.feed;
  S.v = v;
  S.rows = lines[2];
  S.feed = feed;
  S.due = left > 0 ? now() + left * 1000 : 0;
  return changed;
}

function ask(method, url, body, done) {
  var x = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
  busy = true;
  x.onreadystatechange = function () {
    if (x.readyState != 4) return;
    busy = false;
    if (x.status != 200) { say("The wall didn't answer. Try again in a moment."); return; }
    done(x.responseText.split("\n"));
  };
  x.open(method, url, true);
  if (method == "POST") x.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
  x.send(body);
}

function put(x, y) {
  if (busy) return;
  if (S.due > now()) { say("Not yet: the next pixel here in " + Math.ceil((S.due - now()) / 1000) + " seconds."); return; }
  say("Placing " + NAMES[S.c] + " at " + x + "," + y + "...");
  ask("POST", "place.asp", "x=" + x + "&y=" + y + "&c=" + S.c + "&r=" + S.r, function (lines) {
    var said = lines[0];
    take(lines.slice(1));
    if (said == "OK") S.msg = "Placed: " + NAMES[S.c] + " at " + x + "," + y + ".";
    else if (said == "WAIT") S.msg = "Not yet: one pixel every " + S.cool + " seconds.";
    else if (said == "HOLD") S.msg = "Someone just drew in this part of the wall: it takes one pixel every " + S.part + " seconds. Try another part, or wait.";
    else if (said == "BUSY") S.msg = "The wall was busy: try again.";
    else S.msg = "That isn't a square on the wall.";
    redraw();
  });
}

function pick(k) {
  S.c = k;
  S.msg = "";
  redraw();
}

function go(r) {
  if (busy) return;
  say("Going to " + label(r) + "...");
  ask("GET", "data.asp?r=" + r, null, function (lines) {
    S.r = r;
    S.msg = "";
    take(lines);
    redraw();
  });
}

function poll() {
  if (busy) return;
  ask("GET", "data.asp?r=" + S.r, null, function (lines) {
    if (take(lines)) redraw();
  });
}

function tick() {
  document.getElementById("cd").innerText = coolText();
}

document.write(body());
setInterval("tick()", 1000);
setInterval("poll()", 4000);
