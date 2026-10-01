<%@ import file="GEO.SPK" %>
<%
' RINGS.ASP - every webring; start one, join one, leave one.
'   POST do=create  name, desc
'   POST do=join    r
'   POST do=leave   r
VAR home AS String
VAR hood AS String
VAR num AS String
VAR problem AS String
VAR line AS String
VAR p AS Array OF String
VAR out AS String
viewer = CurrentUser()
IF viewer <> "" THEN
    home = HomeOf(viewer)
    hood = home.Split("|")[0]
    num = home.Split("|")[1]
END IF
IF REQUEST.Method = "POST" THEN
    RequireLogin()
    RequireToken()
    SELECT CASE REQUEST.Form("do")
        CASE "create"
            problem = CreateRing(hood, num, REQUEST.Form("name"), REQUEST.Form("desc"))
        CASE "join"
            problem = JoinRing(hood, num, REQUEST.Form("r"))
            IF problem = "" THEN RESPONSE.Redirect("ring.asp?r=" + REQUEST.Form("r"))
        CASE "leave"
            LeaveRing(hood, num, REQUEST.Form("r"))
    END SELECT
    IF problem = "" THEN RESPONSE.Redirect("rings.asp")
END IF
FOR EACH line IN ReadOr(DATADIR + "\RINGS.TXT", "").Lines()
    p = line.Split("|")
    IF p.Count < 4 THEN CONTINUE
    out = out + "<tr><td valign=""top""><font size=""2""><a href=""ring.asp?r=" + p[0] + """><b>" + H(Unesc(p[2])) + "</b></a> <font color=""#808080"">(" + Str(RingMembers(p[0]).Count) + " members)</font><br>" + H(Unesc(p[3])) + "</font></td><td>"
    IF viewer <> "" THEN
        IF InRing(hood, num, p[0]) THEN
            out = out + "<form action=""rings.asp"" method=""post"">" + TokenField() + "<input type=""hidden"" name=""do"" value=""leave""><input type=""hidden"" name=""r"" value=""" + p[0] + """><input type=""submit"" value=""Leave""></form>"
        ELSE
            out = out + "<form action=""rings.asp"" method=""post"">" + TokenField() + "<input type=""hidden"" name=""do"" value=""join""><input type=""hidden"" name=""r"" value=""" + p[0] + """><input type=""submit"" value=""Join""></form>"
        END IF
    END IF
    out = out + "</td></tr>"
    IF out.Length > PAGEROOM THEN BREAK
NEXT
IF out = "" THEN out = "<tr><td><font size=""2"" color=""#808080"">No webrings yet. Start the first one!</font></td></tr>"
%>
<%= Top("Webrings", "GeoSimies webrings: rings of homepages about the same thing. Prev, Next or Random takes you round them all.") %>
<table width="100%" cellpadding="8"><tr><td valign="top">
<h2><font color="#000080">Webrings</font></h2>
<p>A webring joins homepages about the same thing in a circle. At the bottom of every member's
page is <b>[ &lt;&lt; Prev | Ring Name | Next &gt;&gt; | Random ]</b>: follow it round and you'll
see them all.</p>
<%= Notice(problem) %>
<table width="100%" cellpadding="4" cellspacing="2">
<%= out %>
</table>
</td>
<% IF viewer <> "" THEN %>
<td width="280" valign="top">
<%= BoxTop("Start a Webring", "#800080") %>
<form action="rings.asp" method="post"><%= TokenField() %>
<input type="hidden" name="do" value="create">
<p><font size="2">Name:</font><br><input name="name" size="30" maxlength="<%= MAXRINGNAME %>"></p>
<p><font size="2">What's it about?</font><br><%= LimitedBox("desc", "", 3, 30, MAXDESC) %></p>
<p><input type="submit" id="go" value="Start It"></p>
</form>
<%= LimitScript("desc", Str(MAXDESC)) %>
<p><font size="1" color="#808080">Your homepage joins it first. A homepage can be in <%= MAXRINGS %> webrings.</font></p>
</td>
<% END IF %>
</tr></table>
<%= Bottom() %>
