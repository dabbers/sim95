<%@ import file="NIC.SPK" %>
<%
' WHOIS.ASP?d=coolsite.sim - who has a domain, as InterNIC's whois told it.
VAR d AS String
VAR rec AS Array OF String
VAR out AS String
viewer = CurrentUser()
d = CleanDomain(REQUEST.Query("d"))
IF d <> "" THEN
    rec = DomainRec(d)
    IF rec.Count < 6 THEN
        out = "No match for """ + d + """."
    ELSEIF rec[5] <> "active" THEN
        out = "Domain Name: " + d.Upper() + Chr(10) + "Status: on hold (registration not yet paid)"
    ELSE
        out = "Registrant:" + Chr(10) + "   " + NameOf(rec[1]) + " (" + rec[1].Upper() + ")" + Chr(10) + Chr(10) _
            + "   Domain Name: " + d.Upper() + Chr(10) + Chr(10) _
            + "   Record created on " + rec[2] + "." + Chr(10) _
            + "   Record expires on " + rec[3] + "." + Chr(10) + Chr(10) _
            + "   Points to machine: " + Either(PointsTo(d) <> "", PointsTo(d).Upper(), "(none yet)") + Chr(10) + Chr(10) _
            + "   Domain servers in listed order:" + Chr(10) + Chr(10) _
            + "   " + SERVER.Name.Upper()
    END IF
END IF
%><%= Top("WHOIS") %>
<h2>WHOIS</h2>
<form action="whois.asp" method="get"><input name="d" size="30" value="<%= H(d) %>"> <input type="submit" value="Look up"></form>
<% IF out <> "" THEN %><pre><%= H(out) %></pre><% END IF %>
<p><font size="2">The SimNIC WHOIS database is provided for information purposes only.</font></p>
<%= Bottom() %>
