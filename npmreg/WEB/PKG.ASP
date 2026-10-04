<%@ import file="REG.SPK" %>
<%
' PKG.ASP?p=name[&v=version] - one package: how to install it, its README,
' its versions, what it needs and what needs it.
VAR p AS String
VAR v AS String
VAR line AS String
VAR vline AS String
VAR vers AS Array OF String
VAR f AS String
VAR d AS String
VAR rows AS String
VAR deps AS String
VAR users AS String
VAR readme AS String
VAR k AS Integer
p = REQUEST.Query("p").Lower().Trim()
v = REQUEST.Query("v").Trim()
MakeDirs()
line = PkgLine(p)
IF line <> "" THEN
    IF v = "" THEN v = Field(line, 1)
    vline = VersionLine(p, v)
    IF vline = "" THEN
        v = Field(line, 1)
        vline = VersionLine(p, v)
    END IF
    readme = ReadOr(PkgDir(p) + "\" + Field(vline, 1) + "\README.TXT", "")
    vers = Versions(p)
    FOR k = vers.Count - 1 TO 0 STEP -1
        f = vers[k]
        rows = rows + "<tr><td bgcolor=""#FFFFFF""><a href=""pkg.asp?p=" + p + "&v=" + Field(f, 0) + """>" + Field(f, 0) + "</a>"
        IF Field(f, 0) = Field(line, 1) THEN rows = rows + " <font size=""1"" color=""#CB3837"">latest</font>"
        rows = rows + "</td><td bgcolor=""#FFFFFF""><font size=""2"">" + Field(f, 6) + "</font></td><td bgcolor=""#FFFFFF""><font size=""2"">" + Size(Int(Val(Field(f, 3)))) + "</font></td><td bgcolor=""#FFFFFF""><font size=""2"">" + Field(f, 7) + "</font></td></tr>" + Chr(10)
    NEXT
    FOR EACH d IN Field(vline, 8).Split(";")
        IF NOT d.Contains("=") THEN CONTINUE
        f = d.Substring(0, d.IndexOf("="))
        deps = deps + "<li><a href=""pkg.asp?p=" + f + """>" + f + "</a> <font size=""2"" color=""#666666"">" + SERVER.HtmlEncode(d.Substring(d.IndexOf("=") + 1, d.Length - d.IndexOf("=") - 1)) + "</font></li>"
    NEXT
    FOR EACH f IN Dependents(p)
        users = users + "<a href=""pkg.asp?p=" + f + """>" + f + "</a> "
    NEXT
END IF
%><html><head><title><% IF line = "" THEN %>Not found<% ELSE %><%= p %><% END IF %> - npm</title></head>
<body bgcolor="#F2F2F2" text="#333333" link="#CB3837" vlink="#8A2522">
<table width="100%" cellpadding="8" cellspacing="0"><tr><td bgcolor="#CB3837">
<a href="index.asp"><font size="6" color="#FFFFFF"><b>npm</b></font></a> <font color="#FFFFFF">the package registry on <%= SERVER.Name.Lower() %></font></td>
<td bgcolor="#CB3837" align="right"><form action="index.asp" method="get"><input type="text" name="q" size="20"> <input type="submit" value="Search"></form></td></tr></table>
<% IF line = "" THEN %>
<h2>There's no package called <%= SERVER.HtmlEncode(p) %></h2>
<p>Nobody has published one yet. <a href="index.asp?q=<%= SERVER.UrlEncode(p) %>">Search for it</a>, or publish it yourself: <tt>npm init</tt> with that name, then <tt>npm publish</tt>.</p>
<% ELSE %>
<table width="100%" cellpadding="10" cellspacing="0"><tr><td bgcolor="#FFFFFF" valign="top">
<font size="6"><b><%= p %></b></font> <font color="#666666"><%= v %><% IF v <> Field(line, 1) THEN %> (the latest is <a href="pkg.asp?p=<%= p %>"><%= Field(line, 1) %></a>)<% END IF %></font>
<p><%= SERVER.HtmlEncode(Field(line, 2)) %></p>
<table cellpadding="6"><tr><td bgcolor="#000000"><font color="#A4D007"><tt>npm install <%= p %><% IF v <> Field(line, 1) THEN %>@<%= v %><% END IF %></tt></font></td></tr></table>
<hr>
<% IF readme.Trim() = "" THEN %><p><font color="#666666">This package has no README.</font></p><% ELSE %><%= Markdown(readme) %><% END IF %>
</td><td bgcolor="#FFFFFF" valign="top" width="200"><font size="2">
<b>Version</b><br><%= v %><br><br>
<b>Published</b><br><%= Field(vline, 6) %> by <a href="index.asp?u=<%= Field(vline, 7) %>"><%= Field(vline, 7) %></a><br><br>
<b>Owner</b><br><a href="index.asp?u=<%= Field(line, 3) %>"><%= Field(line, 3) %></a><br><br>
<b>Size</b><br><%= Size(Int(Val(Field(vline, 3)))) %> in <%= Field(vline, 2) %> part<% IF Field(vline, 2) <> "1" THEN %>s<% END IF %><br><br>
<b>Downloads</b><br><%= Downloads(p) %><br><br>
<% IF Field(line, 6).Trim() <> "" THEN %><b>Keywords</b><br><%= SERVER.HtmlEncode(Field(line, 6)) %><br><br><% END IF %>
<b>Dependencies</b><br><% IF deps = "" THEN %>none<% ELSE %><ul><%= deps %></ul><% END IF %><br>
<b>Used by</b><br><% IF users = "" THEN %>nothing yet<% ELSE %><%= users %><% END IF %>
</font></td></tr></table>
<h3>Versions</h3>
<table cellpadding="6" cellspacing="2"><tr><td><b>Version</b></td><td><b>Published</b></td><td><b>Size</b></td><td><b>By</b></td></tr>
<%= rows %></table>
<% END IF %>
</body></html>
