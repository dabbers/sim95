<%@ import file="GEO.SPK" %>
<%
' GUEST.ASP?h=hood&n=number - a homepage's guestbook: read it, sign it. Anybody
' may sign; the owner may take entries out (POST do=del, with their token).
' Everything visitors write is escaped.
VAR hood AS String
VAR num AS String
VAR site AS String
VAR problem AS String
VAR entries AS Array OF String
VAR e AS Array OF String
VAR out AS String
VAR i AS Integer
VAR mine AS Bool
VAR back AS String
hood = REQUEST.Query("h").Upper()
num = REQUEST.Query("n")
IF REQUEST.Method = "POST" THEN
    hood = REQUEST.Form("h").Upper()
    num = REQUEST.Form("n")
END IF
site = FindSite(hood, num)
IF site = "" THEN RESPONSE.Redirect("hood.asp")
viewer = CurrentUser()
mine = viewer <> "" AND viewer = site.Split("|")[1]
back = "guest.asp?h=" + hood.Lower() + "&n=" + num
IF REQUEST.Method = "POST" THEN
    IF REQUEST.Form("do") = "del" THEN
        RequireLogin()
        RequireToken()
        IF mine THEN DeleteEntry(hood, num, REQUEST.Form("id"))
        RESPONSE.Redirect(back)
    END IF
    problem = SignGuestbook(hood, num, REQUEST.Form("name"), REQUEST.Form("from"), REQUEST.Form("msg"))
    IF problem = "" THEN RESPONSE.Redirect(back + "&e=thanks")
END IF
entries = GuestEntries(hood, num)
FOR i = entries.Count - 1 TO 0 STEP -1
    e = entries[i].Split("|")
    IF e.Count < 5 THEN CONTINUE
    out = out + "<tr><td bgcolor=""#FFFFE0""><font size=""2""><b>" + H(Unesc(e[2])) + "</b>"
    IF e[3] <> "" THEN out = out + " from " + H(Unesc(e[3]))
    out = out + " <font color=""#808080"">" + e[1] + "</font><br>" + Br(Unesc(e[4])) + "</font>"
    IF mine THEN out = out + "<form action=""guest.asp"" method=""post"">" + TokenField() + "<input type=""hidden"" name=""do"" value=""del""><input type=""hidden"" name=""h"" value=""" + hood.Lower() + """><input type=""hidden"" name=""n"" value=""" + num + """><input type=""hidden"" name=""id"" value=""" + e[0] + """><input type=""submit"" value=""Delete""></form>"
    out = out + "</td></tr>"
    IF out.Length > PAGEROOM THEN
        out = out + "<tr><td><font size=""2"" color=""#808080"">...and older entries.</font></td></tr>"
        BREAK
    END IF
NEXT
IF out = "" THEN out = "<tr><td><font size=""2"" color=""#808080"">Nobody has signed yet. Be the first!</font></td></tr>"
%>
<%= Top("Guestbook: " + SiteTitle(site), "The guestbook of " + SiteTitle(site) + " at " + HoodInfo(hood, 1) + " " + num + " on GeoSimies.") %>
<table width="100%" cellpadding="8" cellspacing="0"><tr><td valign="top">
<h2><font color="#000080">Guestbook</font></h2>
<p><font size="2">for <a href="<%= SiteLink(hood, num) %>"><b><%= H(SiteTitle(site)) %></b></a> at <%= HoodInfo(hood, 1) %> <%= num %></font></p>
<% IF REQUEST.Query("e") = "thanks" THEN %><%= Notice("Thanks for signing!") %><% END IF %>
<%= Notice(problem) %>
<table width="100%" cellpadding="4" cellspacing="2">
<%= out %>
</table>
</td><td width="300" valign="top">
<a name="sign"></a>
<%= BoxTop("Sign the Guestbook", "#008000") %>
<form action="guest.asp" method="post">
<input type="hidden" name="h" value="<%= hood.Lower() %>"><input type="hidden" name="n" value="<%= num %>">
<p><font size="2">Your name:</font><br><input name="name" size="30" value="<%= H(REQUEST.Form("name")) %>"></p>
<p><font size="2">Where are you from?</font><br><input name="from" size="30" value="<%= H(REQUEST.Form("from")) %>"></p>
<p><font size="2">Your message:</font><br><%= LimitedBox("msg", REQUEST.Form("msg"), 6, 34, MAXSIGN) %></p>
<p><input type="submit" id="go" value="Sign It!"></p>
</form>
<%= LimitScript("msg", Str(MAXSIGN)) %>
</td></tr></table>
<%= Bottom() %>
