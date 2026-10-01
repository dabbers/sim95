<%@ import file="NIC.SPK" %>
<%
' HOME.ASP - My Domains: everything you have registered, and a box to get more.
VAR mine AS Array OF String
VAR d AS String
VAR rows AS String
VAR rec AS Array OF String
VAR why AS String
RequireLogin()
mine = DomainsOf(viewer)
FOR EACH d IN mine
    rec = DomainRec(d)
    rows = rows + "<tr><td><a href=""domain.asp?d=" + UrlEnc(d) + """><b>" + H(d) + "</b></a></td><td>" + H(rec[2]) + "</td><td>" + H(rec[3]) + "</td><td>"
    IF PointsTo(d) <> "" THEN
        rows = rows + "<tt>" + H(PointsTo(d)) + "</tt>"
    ELSE
        rows = rows + "<i>nowhere yet</i>"
    END IF
    rows = rows + "</td></tr>"
NEXT
why = REQUEST.Query("why")
IF REQUEST.Query("new") = "1" THEN why = "Welcome to SimNIC! Search for a name below and register it."
%><%= Top("My Domains") %>
<%= Notice(why, REQUEST.Query("new") = "1") %>
<h2>My Domains</h2>
<p>Contact: <b><%= H(NameOf(viewer)) %></b> (<%= H(viewer) %>)</p>
<% IF mine.Count = 0 THEN %>
<p>You haven't registered any domains yet.</p>
<% ELSE %>
<table cellpadding="5" border="1" cellspacing="0">
<tr bgcolor="#CCCCFF"><th>Domain</th><th>Registered</th><th>Expires</th><th>Points to</th></tr>
<%= rows %>
</table>
<% END IF %>
<h3>Register a new domain</h3>
<form action="search.asp" method="get">www.<input name="d" size="24"> <input type="submit" value="Search"></form>
<%= Bottom() %>
