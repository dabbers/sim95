<%@ import file="TRACK.SPK" %>
<%@ import file="STATS.SPK" %>
<%
' CODE.ASP?s=ID[&page=/path] - the HTML to paste into a site's pages: the
' plain tag (every browser), the JavaScript one (Simxplorer, which also tells
' us the page's title and where the visitor came from), and the counter.
VAR line AS String
VAR id AS String
VAR page AS String
RequireLogin()
line = MySite(REQUEST.Query("s"))
id = SF(line, 0)
page = Clip(REQUEST.Query("page"), 120)
IF page = "" THEN page = "/"
%>
<%= Top("Get the Code") %>
<table width="100%" cellpadding="8" cellspacing="0"><tr><td valign="top">
<% IF REQUEST.Query("new") <> "" THEN %>
<%= Notice("Your site is set up! Its SimStats id is " + id + ". Now paste one of these into every page you want counted.") %>
<% END IF %>
<h2><%= H(SF(line, 2)) %> <font size="2">(<%= H(SF(line, 3)) %>, id <tt><%= id %></tt>)</font></h2>
<p><font size="2"><a href="dash.asp?s=<%= id %>">See the stats</a> | <a href="edit.asp?s=<%= id %>">Settings</a></font></p>

<form action="code.asp" method="get"><input type="hidden" name="s" value="<%= id %>">
<font size="2">The page the code goes on: <input name="page" size="30" value="<%= H(page) %>"> <input type="submit" value="Make the code"></font>
<br><font size="1" color="#808080">Like /index.htm or /area95/1001/. Voyager doesn't tell anybody which page it is on, so the plain tag says it itself. Make a tag for each page.</font>
</form>

<%= BoxTop("1. The plain tag - works in every browser") %>
<p><font size="2">An invisible picture, one pixel big. Put it anywhere between <tt>&lt;body&gt;</tt> and <tt>&lt;/body&gt;</tt>.
It works in Voyager and Simxplorer, and on GeoSimies homepages.</font></p>
<textarea name="plain" rows="3" cols="72"><%= H(PlainTag(id, page)) %></textarea>

<%= BoxTop("2. The JavaScript tag - for Simxplorer, with titles and referrers") %>
<p><font size="2">Simxplorer runs the script, which tells SimStats the page's address and title and the page the visitor came from.
Voyager skips JavaScript and uses the plain tag inside <tt>&lt;noscript&gt;</tt>, so everybody is counted exactly once.</font></p>
<textarea name="script" rows="8" cols="72"><%= H(ScriptTag(id, page)) %></textarea>

<%= BoxTop("3. The hit counter - show the world how popular you are") %>
<p><font size="2">Counts like the plain tag, and shows your total in glowing LED digits:</font>
<a href="dash.asp?s=<%= id %>"><img src="hit.asp?s=<%= id %>&b=1&n=1" width="88" height="31" border="0" alt="Your counter"></a></p>
<% IF SF(line, 4) = "1" THEN %>
<p><font size="2">Your stats are public, so the counter links to them.</font></p>
<% ELSE %>
<p><font size="2">It links to SimStats. Make your stats <a href="edit.asp?s=<%= id %>">public</a> and it links to them instead.</font></p>
<% END IF %>
<textarea name="badge" rows="3" cols="72"><%= H(BadgeTag(line, page)) %></textarea>
<p><font size="1" color="#808080">Use one of the three on a page, not two: each one counts.</font></p>
</td></tr></table>
<%= Bottom() %>
