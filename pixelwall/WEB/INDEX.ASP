<%@ import file="WALL.SPK" %>
<%
' INDEX.ASP?r=region&c=colour - the Pixel Wall.
'   Voyager gets plain HTML: each square a link that places a pixel, and a
'   page script that reloads the page every 30 seconds. In each link is a
'   one-colour picture, C0.PIC to CF.PIC (S0-SF with a dot, for the colour in
'   use), since Voyager underlines the text in a link, and a page asks for
'   each picture only once.
'   Simxplorer gets the same wall drawn by JavaScript (WALL.JS), which places
'   pixels and goes round the wall without reloading, and shows other
'   people's pixels as they arrive. ?plain=1 gives it the plain page.
VAR r AS Integer
VAR c AS Integer
VAR rows AS Array OF String
VAR digits AS String
VAR x AS Integer
VAR y AS Integer
VAR k AS Integer
VAR left AS Integer
VAR msg AS String
VAR here AS String
VAR pics AS String
VAR line AS String
VAR mark AS String
r = Num(REQUEST.Query("r"), 0, 15, 5)
c = Num(REQUEST.Query("c"), 0, 15, 0)
left = CoolLeft(REQUEST.From)
SELECT CASE REQUEST.Query("m")
    CASE "ok"
        msg = "Placed: " + ColourName(c) + " at " + Str(Num(REQUEST.Query("x"), 0, SIZE - 1, 0)) + "," + Str(Num(REQUEST.Query("y"), 0, SIZE - 1, 0)) + "."
    CASE "wait"
        msg = "Not yet: one pixel every " + Str(COOLDOWN) + " seconds."
    CASE "busy"
        msg = "The wall was busy: try again."
    CASE "bad"
        msg = "That isn't a square on the wall."
END SELECT
IF Fancy() THEN
    rows = WallRows()
    here = SERVER.ScriptName.Substring(0, LastAt(SERVER.ScriptName, "\") + 1)
%><html><head><title>The Pixel Wall</title><meta name="robots" content="nofollow"></head><body bgcolor="#C0C0C0">
<script language="JavaScript">
var S = {r:<%= r %>, c:<%= c %>, v:<%= Version() %>, cool:<%= COOLDOWN %>, rows:"<%= RegionDigits(rows, r) %>", due:0, left:<%= left %>, feed:unescape("<%= JsEscape(Feed().Join(Chr(10))) %>"), msg:unescape("<%= JsEscape(msg) %>")};
var CODE = unescape("<%= JsEscape(ReadOr(here + "WALL.JS", "document.write('WALL.JS is missing.');")) %>");
eval(CODE);
</script>
</body></html>
<%
    RESPONSE.End()
END IF
rows = WallRows()
digits = RegionDigits(rows, r)
here = REQUEST.Path.Substring(0, LastAt(REQUEST.Path, "/") + 1)
' The pictures by this machine's address, not its name: Voyager asks for them
' all at once, and when several lookups of one name are out at once, the
' network keeps only the last (SIM95-NOTES.md). By name, one picture came.
' (A site served by name, under simweb, keeps them by name, as it must.)
pics = ""
IF REQUEST.Header("X-Base-Path") = "" AND NET.LocalAddress <> "" THEN pics = "http://" + NET.LocalAddress + here
%><html><head><title>The Pixel Wall</title><meta name="robots" content="nofollow"></head>
<body bgcolor="#C0C0C0" link="#000080" vlink="#000080" onload="Page_Load">
<script type="spark">
SUB Page_Load ()
    SYS.Sleep(30000)
    PAGE.Navigate("http://<%= REQUEST.Host %><%= here %>index.asp?r=<%= r %>&c=<%= c %>")
END SUB
</script>
<center><font size="5"><b>The Pixel Wall</b></font><br>
<font size="2">Everyone on the network shares this wall. Pick a colour, then click a square: one pixel every <%= COOLDOWN %> seconds.</font>
<p><table cellspacing="10" border="0"><tr><td valign="top">
<table cellspacing="1" cellpadding="0" border="0" bgcolor="#808080">
<% FOR y = 0 TO TILE - 1 %><tr><% FOR x = 0 TO TILE - 1
    k = HEXDIGITS.IndexOf(digits.CharAt(y * TILE + x)) %><td bgcolor="<%= ColourHex(k) %>"><a href="place.asp?x=<%= (r MOD 4) * TILE + x %>&y=<%= Int(r / 4) * TILE + y %>&c=<%= c %>&r=<%= r %>"><img src="<%= pics %>c<%= HEXDIGITS.CharAt(k) %>.pic" width="20" height="20" alt=""></a></td><% NEXT %></tr>
<% NEXT %></table>
</td><td valign="top">
<b>The whole wall</b><br><img src="<%= pics %>wall.asp?v=<%= Version() %>" width="128" height="128" alt="the wall"><br>
<font size="2">Go to another part:</font><br>
<table cellspacing="1" cellpadding="0" border="0" bgcolor="#808080">
<% FOR k = 0 TO 15
    IF k MOD 4 = 0 THEN RESPONSE.Write("<tr>")
    IF k = r THEN %><td width="32" height="20" align="center" bgcolor="#000080"><font size="2" color="#FFFFFF"><b><%= "ABCD".CharAt(Int(k / 4)) + Str(k MOD 4 + 1) %></b></font></td><% ELSE %><td width="32" height="20" align="center" bgcolor="#FFFFFF"><font size="2"><a href="index.asp?r=<%= k %>&c=<%= c %>"><%= "ABCD".CharAt(Int(k / 4)) + Str(k MOD 4 + 1) %></a></font></td><% END IF
    IF k MOD 4 = 3 THEN RESPONSE.Write("</tr>")
NEXT %></table>
<p><b>Colour:</b> <%= ColourName(c) %><br>
<table cellspacing="1" cellpadding="0" border="0" bgcolor="#808080">
<% FOR k = 0 TO 15
    IF k MOD 8 = 0 THEN RESPONSE.Write("<tr>")
    ' (a one-colour picture in each link, which a link doesn't underline;
    ' the colour in use has a dot in it)
    mark = "c"
    IF k = c THEN mark = "s" %><td bgcolor="<%= ColourHex(k) %>"><a href="index.asp?r=<%= r %>&c=<%= k %>"><img src="<%= pics %><%= mark + HEXDIGITS.CharAt(k) %>.pic" width="20" height="20" alt=""></a></td><%
    IF k MOD 8 = 7 THEN RESPONSE.Write("</tr>")
NEXT %></table>
<p><b><% IF left > 0 THEN %>Next pixel in <%= left %> seconds<% ELSE %>Ready: click a square<% END IF %></b><br>
<font size="2"><%= SERVER.HtmlEncode(msg) %></font>
<p><b>Latest pixels</b><br><font size="2"><% FOR EACH line IN Feed() %><%= SERVER.HtmlEncode(line) %><br><% NEXT %></font>
</td></tr></table>
<p><font size="2">This page reloads itself every 30 seconds. <a href="index.asp?r=<%= r %>&c=<%= c %>">Reload now</a>.
Best viewed in Simxplorer, where new pixels appear by themselves.</font></center>
</body></html>
