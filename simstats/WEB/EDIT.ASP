<%@ import file="TRACK.SPK" %>
<%@ import file="STATS.SPK" %>
<%
' EDIT.ASP?s=ID - a site's settings: its name and address, public stats (a
' page anybody may see, without visitors' addresses), counting on or paused,
' and deleting it with all its numbers.
VAR line AS String
VAR id AS String
VAR problem AS String
VAR url AS String
RequireLogin()
line = MySite(REQUEST.Query("s") + REQUEST.Form("s"))
id = SF(line, 0)
IF REQUEST.Method = "POST" THEN
    RequireToken()
    IF REQUEST.Form("do") = "delete" THEN
        IF REQUEST.Form("sure") = "" THEN
            problem = "Tick the box to say you're sure. Deleted statistics can't be brought back."
        ELSE
            DeleteSite(id)
            RESPONSE.Redirect("index.asp?e=gone")
        END IF
    ELSE
        url = CleanUrl(REQUEST.Form("url"))
        IF Clip(REQUEST.Form("name"), MAXNAME) = "" THEN
            problem = "Give your site a name."
        ELSEIF url = "" THEN
            problem = "Type your site's address, like http://bravo/."
        ELSE
            SetSiteField(id, 2, Clip(REQUEST.Form("name"), MAXNAME))
            SetSiteField(id, 3, url)
            IF REQUEST.Form("public") = "" THEN
                SetSiteField(id, 4, "0")
            ELSE
                SetSiteField(id, 4, "1")
            END IF
            IF REQUEST.Form("on") = "" THEN
                SetSiteField(id, 6, "0")
            ELSE
                SetSiteField(id, 6, "1")
            END IF
            problem = "Saved."
        END IF
        line = SiteLine(id)
    END IF
END IF
%>
<%= Top("Settings") %>
<table width="100%" cellpadding="8" cellspacing="0"><tr><td valign="top">
<%= Notice(problem) %>
<h2><%= H(SF(line, 2)) %> <font size="2">(id <tt><%= id %></tt>)</font></h2>
<p><font size="2"><a href="dash.asp?s=<%= id %>">See the stats</a> | <a href="code.asp?s=<%= id %>">Get the code</a></font></p>
<%= BoxTop("Settings") %>
<form action="edit.asp" method="post"><%= TokenField() %><input type="hidden" name="s" value="<%= id %>">
<table cellpadding="3">
<tr><td><font size="2">Name:</font></td><td><input name="name" size="30" maxlength="<%= MAXNAME %>" value="<%= H(SF(line, 2)) %>"></td></tr>
<tr><td><font size="2">Address:</font></td><td><input name="url" size="30" maxlength="<%= MAXURL %>" value="<%= H(SF(line, 3)) %>"></td></tr>
<tr><td></td><td><input type="checkbox" name="public" value="1"<% IF SF(line, 4) = "1" THEN %> checked<% END IF %>> <font size="2">Public stats: anybody can see them at
<a href="public.asp?s=<%= id %>">public.asp?s=<%= id %></a> (never your visitors' addresses)</font></td></tr>
<tr><td></td><td><input type="checkbox" name="on" value="1"<% IF SF(line, 6) = "1" THEN %> checked<% END IF %>> <font size="2">Counting is on (untick to pause it)</font></td></tr>
<tr><td></td><td><input type="submit" value="Save"></td></tr>
</table>
</form>
<%= BoxTop("Delete This Site") %>
<form action="edit.asp" method="post"><%= TokenField() %><input type="hidden" name="s" value="<%= id %>"><input type="hidden" name="do" value="delete">
<p><font size="2"><input type="checkbox" name="sure" value="1"> I'm sure: delete <b><%= H(SF(line, 2)) %></b> and every number SimStats has for it.
<input type="submit" value="Delete"></font></p>
<p><font size="1" color="#808080">The tags on your pages keep showing their picture, but nothing is counted any more.</font></p>
</form>
</td></tr></table>
<%= Bottom() %>
