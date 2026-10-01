<%
' INDEX.ASP - SimHost's front door (http://<machine>/): every web app on this
' machine, each in a folder of its own, with a line on what it is.
VAR here AS String
VAR rows AS String
VAR apps AS Array OF String
VAR a AS String
VAR p AS Array OF String
VAR n AS Integer
VAR known AS String
VAR counter AS String
here = SERVER.Name.Lower()

apps.Add("BOOK|BOOK.SPK|SimBook|The social network: profiles, friends, a news feed, walls, photos and pokes.|#3B5998")
apps.Add("MAIL|MAIL.SPK|ColdMail|Free webmail, with a real mail server behind it. Your address is you@" + here + ".|#2E5E8C")
apps.Add("ASK|ASK.SPK|AskSim|A search engine with a real crawler that goes round every machine on the network.|#8B1A1A")
apps.Add("GEO|GEO.SPK|GeoSimies|Free homepages for everybody: neighborhoods, hit counters, guestbooks and webrings.|#008080")
apps.Add("ELIZA|BOT.SPK|ELIZA-95|A chatbot with Language-Model-of-Certain-Size manners.|#2F6F4F")
apps.Add("PAL|PAL.SPK|SimPal|Send and request money in SimBucks, and pay at any shop with a Pay with SimPal button.|#003087")
apps.Add("TUBE|TUBE.SPK|SimTube|Movies: watch them, put yours up, give them stars. They play in SimPlayer.|#CC0000")
apps.Add("STATS|STATS.SPK|SimStats|Web statistics for any site: hits, visitors, top pages, referrers and a hit counter.|#003366")
apps.Add("VAPOR|CATALOG.TXT|Vapor|The store: get Vapor, then games and every SIM95 program.|#1B2838")
' Apps that leave an APP.INF in their folder (name|blurb|colour) say how they
' show here; the list above covers ones installed before they did.
FOR EACH a IN FS.List("C:\WEB")
    IF NOT a.EndsWith("\") THEN CONTINUE
    a = a.Substring(0, a.Length - 1).Upper()
    IF FS.Exists("C:\WEB\" + a + "\APP.INF") THEN
        p = FS.Read("C:\WEB\" + a + "\APP.INF").Trim().Split("|")
        IF p.Count >= 3 THEN
            n = n + 1
            rows = rows + Row(a, p[0], p[1], p[2], here)
            CONTINUE
        END IF
    END IF
    FOR EACH known IN apps
        p = known.Split("|")
        IF p[0] = a AND FS.Exists("C:\WEB\" + a + "\" + p[1]) THEN
            n = n + 1
            rows = rows + Row(a, p[2], p[3], p[4], here)
        END IF
    NEXT
NEXT
IF n = 0 THEN rows = "<tr><td>No web apps here yet. Install SimBook, ColdMail, AskSim, GeoSimies, ELIZA-95, SimPal, SimTube or SimStats (from Vapor, or with their INSTALL.SPK): each goes in a folder of its own and shows up here.</td></tr>"
' With SimStats in /stats/, this page counts its visitors as "this machine",
' the site SimStats' installer made for it (its id is in C:\STATDATA\HOME.TXT).
IF FS.Exists("C:\WEB\STATS\STATS.SPK") AND FS.Exists("C:\STATDATA\HOME.TXT") THEN
    counter = "<img src=""/stats/hit.asp?s=" + SERVER.UrlEncode(FS.Read("C:\STATDATA\HOME.TXT").Trim()) + "&p=/&t=" + SERVER.UrlEncode(SERVER.Name + " - SimHost") + """ width=""1"" height=""1"" alt="""">"
END IF
%>
<script runat="server">
' One app's row on the front page.
FUNCTION Row (folder AS String, name AS String, blurb AS String, colour AS String, here AS String) AS String
    RETURN "<tr><td bgcolor=""" + SERVER.HtmlEncode(colour) + """ width=""150""><a href=""/" + folder.Lower() + "/""><font color=""#FFFFFF"" size=""4""><b>" + SERVER.HtmlEncode(name) + "</b></font></a></td>" _
        + "<td>" + SERVER.HtmlEncode(blurb) + "<br><font size=""2""><a href=""/" + folder.Lower() + "/"">http://" + here + "/" + folder.Lower() + "/</a></font></td></tr>"
END FUNCTION
</script>
<html>
<head>
<title><%= SERVER.Name %> - SimHost</title>
<meta name="description" content="SimHost: one machine running every SIM95 web app. Social network, webmail, search engine, free homepages, chat bot and the Vapor store.">
<meta name="keywords" content="home page, portal, web host, social network, email, search engine, free homepages, chat bot, games">
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
</font><%= counter %>
</body>
</html>
