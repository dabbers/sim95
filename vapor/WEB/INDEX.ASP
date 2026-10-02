<%
' INDEX.ASP - the Vapor store's web site (http://<machine>/vapor/): download
' Vapor, and see what is on the shelves.
VAR line AS String
VAR p AS Array OF String
VAR here AS String
VAR apps AS String
VAR games AS String
VAR row AS String
VAR client AS String
VAR kind AS String
VAR bridge AS String
here = SERVER.Name.Lower()
' stocked from GitHub by tools/vapor-bridge.js: repo|ref|commit|when
IF FS.Exists("C:\WEB\VAPOR\BRIDGE.TXT") THEN
    p = FS.Read("C:\WEB\VAPOR\BRIDGE.TXT").Trim().Split("|")
    IF p.Count >= 4 THEN bridge = "The shelves were last stocked from " + p[0] + " (" + p[1] + ", " + p[2].Substring(0, MATH.Min(7, p[2].Length)) + ") on " + p[3] + "."
END IF
IF FS.Exists("C:\WEB\VAPOR\CATALOG.TXT") THEN
    FOR EACH line IN FS.Read("C:\WEB\VAPOR\CATALOG.TXT").Lines()
        p = line.Split("|")
        IF p.Count < 7 THEN CONTINUE
        kind = "game"
        IF p.Count > 7 THEN kind = p[7]
        IF kind = "client" THEN
            client = "build " + p[8]
            CONTINUE
        END IF
        row = "<tr><td bgcolor=""#1B2838"" valign=""top""><font color=""#66C0F4""><b>" + SERVER.HtmlEncode(p[1]) + "</b></font><br><font size=""2"" color=""#C7D5E0"">" + SERVER.HtmlEncode(p[6].Replace("%0A", " ").Replace("%7C", "|").Replace("%25", "%")) + "</font></td>"
        IF p[4] = "soon" THEN
            row = row + "<td bgcolor=""#1B2838"" align=""right"" valign=""top"" width=""140""><font color=""#8F98A0"">Coming soon</font></td></tr>"
        ELSE
            row = row + "<td bgcolor=""#1B2838"" align=""right"" valign=""top"" width=""140""><font color=""#A4D007""><b>Free</b></font><br><font size=""1"" color=""#8F98A0"">" + SERVER.HtmlEncode(p[5]) + ", " + Str(Int(Val(p[3]) / 1024) + 1) + " KB"
            IF p.Count > 8 THEN row = row + "<br>build " + p[8]
            row = row + "</font></td></tr>"
        END IF
        IF kind = "game" THEN
            games = games + row
        ELSE
            apps = apps + row
        END IF
    NEXT
END IF
%><html><head><title>Vapor - games and apps for SIM95</title>
<meta name="description" content="Download Vapor, the store for SIM95: free games like SimDOOM and Snake 95, and apps like Simxplorer, Frostbird, Clippy and SimBook, with updates, a library, play time and achievements.">
<meta name="keywords" content="download, vapor, steam, games, video games, game store, app store, apps, software, programs, free downloads, updates, doom, browser, email, mail client, clippy, social network">
</head>
<body bgcolor="#171A21" text="#C7D5E0" link="#66C0F4" vlink="#66C0F4">
<table width="100%" cellpadding="8" cellspacing="0"><tr><td bgcolor="#171A21">
<font size="6" color="#FFFFFF"><b>VAPOR</b></font> <font color="#66C0F4">store on <%= here %></font></td>
<td bgcolor="#171A21" align="right"><font size="2"><a href="#download">Download</a> &middot; <a href="#apps">Apps</a> &middot; <a href="#games">Games</a></font></td></tr></table>

<a name="download"></a>
<table width="100%" cellpadding="14" cellspacing="0"><tr><td bgcolor="#2A475E">
<font size="5" color="#FFFFFF"><b>Get Vapor</b></font><br>
<font color="#C7D5E0">Games, programs and web apps for SIM95, in one place. Install with a click, keep everything up to date, count your hours, collect achievements.</font>
<p><font color="#FFFFFF"><b>On a new machine:</b></font> open SPARK, paste these lines, and press <b>F5</b>. They fetch Vapor from <%= here %> and start it; Vapor installs the rest.</p>
<table width="100%" cellpadding="6"><tr><td bgcolor="#000000"><pre><font color="#A4D007"><%= SERVER.HtmlEncode(FS.Read("C:\WEB\VAPOR\GO.TXT").Replace("%HOST%", here.Split(".")[0])) %></font></pre></td></tr></table>
<p><font size="2" color="#8F98A0">The same lines, as plain text: <a href="go.asp">go.asp</a>.
Or the long way: open <a href="getvapor.asp">getvapor.asp</a> in Simxplorer, <b>File &gt; Save As File</b> as <tt>C:\MYFILES\GETVAPOR.SPK</tt>, and run that. Vapor <%= client %>.</font></p>
</td></tr></table>

<a name="apps"></a>
<h3><font color="#FFFFFF">Apps</font></h3>
<table width="100%" cellpadding="8" cellspacing="2"><%= apps %></table>
<% IF apps = "" THEN %><p><font size="2" color="#8F98A0">No apps on the shelves yet. The store's keeper can add them: save any app's INSTALL.SPK in C:\MYFILES on <%= here %>, then Vapor &gt; Publish Apps.</font></p><% END IF %>

<a name="games"></a>
<h3><font color="#FFFFFF">Games</font></h3>
<table width="100%" cellpadding="8" cellspacing="2"><%= games %></table>

<h3><font color="#FFFFFF">GETVAPOR.SPK</font></h3>
<table width="100%" cellpadding="6"><tr><td bgcolor="#000000"><pre><font color="#A4D007"><%= SERVER.HtmlEncode(FS.Read("C:\WEB\VAPOR\GETVAPOR.TXT").Replace("%HOST%", here)) %></font></pre></td></tr></table>
<p><font size="2" color="#8F98A0">Run your own store: any machine where Vapor's INSTALL.SPK ran is one. Keep its shelves stocked
and up to date with Publish Apps. Half-Life 3 is coming soon.</font></p>
<% IF bridge <> "" THEN %><p><font size="1" color="#8F98A0"><%= SERVER.HtmlEncode(bridge) %></font></p><% END IF %>
</body></html>
