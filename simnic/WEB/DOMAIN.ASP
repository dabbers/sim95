<%@ import file="NIC.SPK" %>
<%
' DOMAIN.ASP?d=coolsite.sim - one of your domains: the machine it points to
' (the one field most people need), then Advanced DNS for anything else.
VAR d AS String
VAR rec AS Array OF String
VAR recs AS Array OF String
VAR w AS Array OF String
VAR rows AS String
VAR i AS Integer
VAR why AS String
VAR machine AS String
VAR pointed AS String
RequireLogin()
d = CleanDomain(REQUEST.Query("d"))
IF NOT Owns(viewer, d) THEN RESPONSE.Redirect("home.asp?why=" + UrlEnc("That is not one of your domains."))
rec = DomainRec(d)
recs = Records(d)
FOR i = 0 TO recs.Count - 1
    w = Words(recs[i])
    IF w.Count < 3 THEN CONTINUE
    rows = rows + "<tr><td><tt>" + H(w[0]) + "</tt></td><td><tt>" + H(RecTypeOf(w)) + "</tt></td><td><tt>" + H(RecValueOf(recs[i], w)) + "</tt></td>" _
        + "<td><form action=""record.asp"" method=""post"">" + TokenField() + "<input type=""hidden"" name=""d"" value=""" + H(d) + """><input type=""hidden"" name=""op"" value=""del""><input type=""hidden"" name=""n"" value=""" + Str(i) + """><input type=""submit"" value=""Delete""></form></td></tr>"
NEXT
pointed = PointsTo(d)
machine = pointed
IF machine = "" THEN machine = LastMachine(viewer)
why = REQUEST.Query("why")
IF REQUEST.Query("new") = "1" THEN why = "Congratulations! " + d + " is yours until " + rec[3] + ". Now point it at the machine your site is on."
%><%= Top(d) %>
<%= Notice(why, REQUEST.Query("new") = "1" OR REQUEST.Query("ok") = "1") %>
<h2><%= H(d) %></h2>
<table cellpadding="3">
<tr><td><b>Registrant:</b></td><td><%= H(NameOf(viewer)) %></td></tr>
<tr><td><b>Registered:</b></td><td><%= H(rec[2]) %></td></tr>
<tr><td><b>Expires:</b></td><td><%= H(rec[3]) %></td></tr>
<tr><td><b>Name server:</b></td><td><%= H(SERVER.Name.Lower()) %> (SimDNS)</td></tr>
</table>

<form action="point.asp" method="post"><%= TokenField() %><input type="hidden" name="d" value="<%= H(d) %>">
<table cellpadding="8" bgcolor="#000066"><tr><td><font color="#FFFFFF">
<b><tt><%= H(d) %></tt> points to machine:</b></font>
<input name="machine" size="24" value="<%= H(machine) %>"> <input type="submit" value="Save">
</td></tr></table>
</form>
<% IF pointed <> "" THEN %>
<p><b><%= H(d) %></b> and <b>www.<%= H(d) %></b> go to the machine <b><%= H(pointed) %></b>.</p>
<% ELSE %>
<p><%= H(d) %> doesn't point anywhere yet.</p>
<% END IF %>
<p><font size="2">Type the name of the SIM95 machine your web site is on (what its owner sees in
Network, like <tt>alpha</tt>), and press Save. SimNIC points <tt><%= H(d) %></tt> and
<tt>www.<%= H(d) %></tt> at it. Then, <b>on that machine</b>, add the site in
<b>Personal Web Manager</b> (simweb, from any Vapor store), so its web server knows which pages
<%= H(d) %> gets. Leave the box empty to point it nowhere.</font></p>

<hr>
<h3>Advanced DNS</h3>
<p><font size="2">Most domains need nothing here. Use it for more names under your domain
(<tt>book.<%= H(d) %></tt>), mail, or notes.</font></p>
<% IF rows <> "" THEN %>
<table cellpadding="4" border="1" cellspacing="0">
<tr bgcolor="#CCCCFF"><th>Name</th><th>Type</th><th>Points at</th><th>&nbsp;</th></tr>
<%= rows %>
</table>
<% END IF %>
<form action="record.asp" method="post">
<%= TokenField() %><input type="hidden" name="d" value="<%= H(d) %>"><input type="hidden" name="op" value="add">
<table cellpadding="3" bgcolor="#EEEEFF"><tr><td>
<input name="name" size="10" value="">.<%= H(d) %>
<select name="type"><option value="CNAME" selected>CNAME</option><option value="MX">MX</option><option value="TXT">TXT</option><option value="A">A</option></select>
<input name="value" size="24" value="<%= H(machine) %>">
<input type="submit" value="Add Record">
</td></tr></table>
</form>
<font size="2"><ul>
<li><b>CNAME</b> - another name under your domain, pointed at a machine: <tt>book</tt> CNAME <tt><%= H(Either(machine <> "", machine, "alpha")) %></tt>
makes <tt>book.<%= H(d) %></tt>. <tt>*</tt> stands for every name you haven't listed. (Then add <tt>book.<%= H(d) %></tt> in Personal Web Manager on that machine.)</li>
<li><b>MX</b> - your machine, to get mail at your domain with ColdMail: <tt>@</tt> MX <tt>10 <%= H(Either(machine <> "", machine, "alpha")) %></tt>
(that machine's ColdMail must list <tt><%= H(d) %></tt> in <tt>C:\MAILDATA\DOMAINS.TXT</tt>, or it works it out itself).</li>
<li><b>TXT</b> - a line of text, for anyone who asks.</li>
<li><b>A</b> - an address. Addresses change when a machine restarts, so prefer CNAME.</li>
</ul></font>
<%= Bottom() %>
