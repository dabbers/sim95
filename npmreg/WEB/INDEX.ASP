<%@ import file="REG.SPK" %>
<%
' INDEX.ASP - the npm registry's front page (http://<machine>/npm/):
'   ?q=words   search
'   ?u=name    one person's packages
' and with neither, the newest packages and how to start.
VAR q AS String
VAR byUser AS String
VAR found AS Array OF String
VAR line AS String
VAR rows AS String
VAR shown AS Integer
VAR heading AS String
VAR all AS Array OF String
MakeDirs()
q = REQUEST.Query("q").Trim()
byUser = REQUEST.Query("u").Lower().Trim()
all = Packages()
IF byUser <> "" THEN
    FOR EACH line IN Newest(all)
        IF Field(line, 3) = byUser THEN found.Add(line)
    NEXT
    heading = "Packages by " + byUser
ELSEIF q <> "" THEN
    found = Search(q)
    heading = Str(found.Count) + " packages found for " + Chr(34) + q + Chr(34)
    IF found.Count = 1 THEN heading = "1 package found for " + Chr(34) + q + Chr(34)
ELSE
    found = Newest(all)
    heading = "Recently updated"
END IF
FOR EACH line IN found
    shown = shown + 1
    IF shown > 40 THEN BREAK
    rows = rows + "<tr><td bgcolor=""#FFFFFF""><a href=""pkg.asp?p=" + Field(line, 0) + """><b>" + Field(line, 0) + "</b></a> <font size=""2"" color=""#666666"">" + SERVER.HtmlEncode(Field(line, 1)) + "</font><br><font size=""2"">" + SERVER.HtmlEncode(Field(line, 2)) + "</font>"
    IF Field(line, 6).Trim() <> "" THEN rows = rows + "<br><font size=""1"" color=""#666666"">" + SERVER.HtmlEncode(Field(line, 6)) + "</font>"
    rows = rows + "</td><td bgcolor=""#FFFFFF"" align=""right"" valign=""top"" width=""150""><font size=""2""><a href=""index.asp?u=" + Field(line, 3) + """>" + Field(line, 3) + "</a><br><font color=""#666666"">" + Ago(Int(Val(Field(line, 4)))) + "</font></font></td></tr>" + Chr(10)
NEXT
%><html><head><title>npm - the SIM95 package registry</title>
<meta name="description" content="npm for SIM95: JavaScript packages for Node on SIM95. Search, install with npm install, and publish your own.">
<meta name="keywords" content="npm, node, node.js, javascript, packages, modules, registry, library, libraries, require, install, publish, code, programming">
</head>
<body bgcolor="#F2F2F2" text="#333333" link="#CB3837" vlink="#8A2522">
<table width="100%" cellpadding="8" cellspacing="0"><tr><td bgcolor="#CB3837">
<a href="index.asp"><font size="6" color="#FFFFFF"><b>npm</b></font></a> <font color="#FFFFFF">the package registry on <%= SERVER.Name.Lower() %></font></td>
<td bgcolor="#CB3837" align="right"><font size="2" color="#FFFFFF"><%= all.Count %> package<% IF all.Count <> 1 THEN %>s<% END IF %> &middot; <%= UserCount() %> <% IF UserCount() = 1 THEN %>person<% ELSE %>people<% END IF %></font></td></tr></table>
<table width="100%" cellpadding="8" cellspacing="0"><tr><td bgcolor="#FFFFFF">
<form action="index.asp" method="get"><input type="text" name="q" size="40" value="<%= SERVER.HtmlEncode(q) %>"> <input type="submit" value="Search packages"></form>
</td></tr></table>

<% IF q = "" AND byUser = "" THEN %>
<table width="100%" cellpadding="10" cellspacing="0"><tr><td bgcolor="#FFF7E6">
<font size="4"><b>JavaScript packages for Node on SIM95</b></font>
<p>npm comes with Node: install <b>Node.js for SIM95</b> from Vapor (or <tt>sim-get install node</tt> in Sim Shell). Then, in Sim Shell:</p>
<pre>npm init -y                 a PACKAGE.JSN for your project
npm install leftpad         a package, into NODE_MOD (and your PACKAGE.JSN)
npm install                 everything your PACKAGE.JSN lists
npm search color            find packages
npm adduser                 make an account here (or log in to yours)
npm publish                 share the package in this folder
npm install -g cowsay       a package with a command, for the whole machine</pre>
<p><font size="2">Package names are 8.3 folder names: 1 to 8 of a-z, 0-9, - and _. Then <tt>require('leftpad')</tt> finds <tt>NODE_MOD\LEFTPAD</tt>.</font></p>
</td></tr></table>
<% END IF %>

<h3><%= SERVER.HtmlEncode(heading) %></h3>
<% IF rows = "" THEN %>
<p><font color="#666666"><% IF all.Count = 0 THEN %>Nothing has been published yet. Be the first: <tt>npm adduser</tt>, then <tt>npm publish</tt> in your package's folder.<% ELSE %>No packages match.<% END IF %></font></p>
<% ELSE %>
<table width="100%" cellpadding="8" cellspacing="2"><%= rows %></table>
<% END IF %>
<p><font size="1" color="#666666">npm for SIM95. Packages are whatever people publish: read before you run.</font></p>
</body></html>
