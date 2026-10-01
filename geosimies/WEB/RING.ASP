<%@ import file="GEO.SPK" %>
<%
' RING.ASP?r=id - one webring and its members.
' RING.ASP?r=id&go=next|prev|rand&h=hood&n=number - the webring bar at the
' bottom of every member's page: on to the next homepage round the ring.
VAR id AS String
VAR ring AS String
VAR there AS String
VAR m AS String
VAR site AS String
VAR out AS String
VAR home AS String
id = REQUEST.Query("r")
ring = FindRing(id)
IF ring = "" THEN RESPONSE.Redirect("rings.asp")
IF REQUEST.Query("go") <> "" THEN
    there = RingStep(id, REQUEST.Query("h").Lower() + "/" + REQUEST.Query("n"), REQUEST.Query("go"))
    IF there = "" THEN RESPONSE.Redirect("ring.asp?r=" + id)
    RESPONSE.Redirect(there + "/")
END IF
viewer = CurrentUser()
IF viewer <> "" THEN home = HomeOf(viewer)
FOR EACH m IN RingMembers(id)
    site = FindSite(m.Split("/")[0], m.Split("/")[m.Split("/").Count - 1])
    IF site = "" THEN CONTINUE
    out = out + "<tr><td><font size=""2""><a href=""" + m + "/""><b>" + H(SiteTitle(site)) + "</b></a> <font color=""#808080"">" + HoodInfo(m.Split("/")[0], 1) + " " + site.Split("|")[0] + "</font><br>" + H(SiteDesc(site)) + "</font></td></tr>"
    IF out.Length > PAGEROOM THEN BREAK
NEXT
%>
<%= Top("Webring: " + RingName(ring), RingName(ring) + ": a GeoSimies webring. " + RingDesc(ring)) %>
<table width="100%" cellpadding="8"><tr><td valign="top">
<h2><font color="#800080"><%= H(RingName(ring)) %></font></h2>
<p><%= H(RingDesc(ring)) %></p>
<p><font size="2">Started by <a href="<%= ring.Split("|")[1] %>/"><%= HoodInfo(ring.Split("|")[1].Split("/")[0], 1) %> <%= ring.Split("|")[1].Split("/")[1] %></a>.
<a href="ring.asp?r=<%= id %>&go=rand">Visit a random member</a> &middot; <a href="rings.asp">All webrings</a></font></p>
<% IF viewer <> "" AND home <> "" THEN %>
<% IF NOT InRing(home.Split("|")[0], home.Split("|")[1], id) THEN %>
<form action="rings.asp" method="post"><%= TokenField() %><input type="hidden" name="do" value="join"><input type="hidden" name="r" value="<%= id %>"><input type="submit" value="Join This Webring"></form>
<% END IF %>
<% END IF %>
<%= BoxTop("Members", "#800080") %>
<table width="100%" cellpadding="4" cellspacing="2">
<%= out %>
</table>
</td></tr></table>
<%= Bottom() %>
