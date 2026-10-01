<%
' INDEX.ASP - SimHost's front door (http://<machine>/): every web app on this
' machine, each in a folder of its own, with a line on what it is.
VAR here AS String
VAR rows AS String
VAR apps AS Array OF String
VAR a AS String
VAR p AS Array OF String
VAR n AS Integer
here = SERVER.Name.Lower()
apps.Add("BOOK|BOOK.SPK|SimBook|The social network: profiles, friends, a news feed, walls, photos and pokes.|#3B5998")
apps.Add("MAIL|MAIL.SPK|ColdMail|Free webmail, with a real mail server behind it. Your address is you@" + here + ".|#2E5E8C")
apps.Add("ASK|ASK.SPK|AskSim|A search engine with a real crawler that goes round every machine on the network.|#8B1A1A")
apps.Add("ELIZA|BOT.SPK|ELIZA-95|A chatbot with large-language-model manners.|#2F6F4F")
apps.Add("TUBE|TUBE.SPK|SimTube|Movies: watch them, put yours up, give them stars. They play in SimPlayer.|#CC0000")
apps.Add("VAPOR|CATALOG.TXT|Vapor|The store: get Vapor, then games and every SIM95 program.|#1B2838")
FOR EACH a IN apps
    p = a.Split("|")
    IF NOT FS.Exists("C:\WEB\" + p[0] + "\" + p[1]) THEN CONTINUE
    n = n + 1
    rows = rows + "<tr><td bgcolor=""" + p[4] + """ width=""150""><a href=""/" + p[0].Lower() + "/""><font color=""#FFFFFF"" size=""4""><b>" + p[2] + "</b></font></a></td>" _
        + "<td>" + SERVER.HtmlEncode(p[3]) + "<br><font size=""2""><a href=""/" + p[0].Lower() + "/"">http://" + here + "/" + p[0].Lower() + "/</a></font></td></tr>"
NEXT
IF n = 0 THEN rows = "<tr><td>No web apps here yet. Install SimBook, ColdMail, AskSim or ELIZA-95 (from Vapor, or with their INSTALL.SPK): each goes in a folder of its own and shows up here.</td></tr>"
%>
<html>
<head>
<title><%= SERVER.Name %> - SimHost</title>
<meta name="description" content="SimHost: one machine running every SIM95 web app. Social network, webmail, search engine, chat bot and the Vapor store.">
<meta name="keywords" content="home page, portal, web host, social network, email, search engine, chat bot, games">
</head>
<body bgcolor="#FFFFFF">
<table width="100%" cellpadding="8" bgcolor="#000080"><tr><td><font color="#FFFFFF" size="6"><b><%= SERVER.Name %></b></font><br><font color="#C0C0FF">a SimHost machine: <%= n %> web app<% IF n <> 1 THEN %>s<% END IF %> on one computer</font></td></tr></table>
<p>
<table width="100%" cellpadding="8" cellspacing="4">
<%= rows %>
</table>
<p><font size="2">
<% IF FS.Exists("C:\WEB\WELCOME.HTM") THEN %><a href="/welcome.htm">The old home page</a> &middot; <% END IF %>
Moving in from another machine? Run C:\PROGRAMS\MOVEIN.SPK here.
</font>
</body>
</html>
