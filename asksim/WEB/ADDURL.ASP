<%@ import file="ASK.SPK" %>
<%
' ADDURL.ASP - tell Simms about a site; the crawler starts there next time.
VAR url AS String
VAR said AS String
VAR seeds AS String
IF REQUEST.Method = "POST" THEN
    url = REQUEST.Form("url").Trim().Lower()
    IF NOT url.StartsWith("http://") THEN url = "http://" + url
    seeds = ReadOr(DATADIR + "\SEEDS.TXT", "")
    IF url.Length > 120 OR url.Length < 9 OR url.Contains(" ") OR url.Contains("|") THEN
        said = "That doesn't look like an address. Try http://machine/ or http://machine/page.htm"
    ELSEIF (Chr(10) + seeds).Contains(Chr(10) + url + Chr(10)) THEN
        said = "Simms already has " + url + " on his list."
    ELSEIF seeds.Lines().Count > MAXSEEDS THEN
        said = "Simms's list is quite full, thank you. He will find more sites by following links."
    ELSE
        IF NOT FS.Exists(DATADIR) THEN FS.MakeDir(DATADIR)
        FS.Append(DATADIR + "\SEEDS.TXT", url + Chr(10))
        said = "Thank you! Simms will call on " + url + " the next time he goes round the network."
    END IF
END IF
%>
<%= TopFor("Add your site - AskSim", "noindex,nofollow") %>
<table width="100%" cellpadding="6" cellspacing="0" bgcolor="#E8DDF0"><tr>
<td width="50"><a href="index.asp"><img src="simms.pic" alt="Simms"></a></td>
<td><a href="index.asp"><font size="5" color="#660099"><b>AskSim</b></font></a></td>
</tr></table>
<h3>Add your site</h3>
<% IF said <> "" THEN %><p><font size="2"><b><%= H(said) %></b></font></p><% END IF %>
<p><font size="2">Simms visits every machine he can see, but not every page links to every other.
Tell him where to start, and he will follow the links from there.</font></p>
<form action="addurl.asp" method="post">
<p><input name="url" size="50" maxlength="120" value="http://"> <input type="submit" value="Add"></p>
</form>
<p><font size="1" color="#808080">Simms is a polite robot: he reads /robots.txt, and stays out of any
path it lists after "Disallow:".</font></p>
<%= Bottom() %>
