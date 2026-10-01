<%@ import file="NIC.SPK" %>
<%
' DOMAIN.ASP?d=coolsite.sim - one of your domains: its records (add and
' delete), Host it here, and on a SimHost machine a name for each web app.
VAR d AS String
VAR rec AS Array OF String
VAR recs AS Array OF String
VAR line AS String
VAR w AS Array OF String
VAR rows AS String
VAR i AS Integer
VAR folder AS String
VAR apps AS Array OF String
VAR a AS String
VAR names AS String
VAR why AS String
VAR here AS String
RequireLogin()
d = CleanDomain(REQUEST.Query("d"))
IF NOT Owns(viewer, d) THEN RESPONSE.Redirect("home.asp?why=" + UrlEnc("That is not one of your domains."))
here = SERVER.Name.Lower()
rec = DomainRec(d)
recs = Records(d)
FOR i = 0 TO recs.Count - 1
    w = Words(recs[i])
    IF w.Count < 3 THEN CONTINUE
    rows = rows + "<tr><td><tt>" + H(w[0]) + "</tt></td><td><tt>" + H(RecTypeOf(w)) + "</tt></td><td><tt>" + H(RecValueOf(recs[i], w)) + "</tt></td>" _
        + "<td><form action=""record.asp"" method=""post"">" + TokenField() + "<input type=""hidden"" name=""d"" value=""" + H(d) + """><input type=""hidden"" name=""op"" value=""del""><input type=""hidden"" name=""n"" value=""" + Str(i) + """><input type=""submit"" value=""Delete""></form></td></tr>"
NEXT
folder = SiteFolder(d)
apps = AppFolders()
FOR EACH a IN apps
    names = names + "<li><tt>" + a.Split("|")[0].Lower() + "." + H(d) + "</tt> - " + H(a.Split("|")[1]) + "</li>"
NEXT
why = REQUEST.Query("why")
IF REQUEST.Query("new") = "1" THEN why = "Congratulations! " + d + " is yours until " + rec[3] + "."
%><%= Top(d) %>
<%= Notice(why, REQUEST.Query("new") = "1" OR REQUEST.Query("ok") = "1") %>
<h2><%= H(d) %></h2>
<table cellpadding="3">
<tr><td><b>Registrant:</b></td><td><%= H(NameOf(viewer)) %></td></tr>
<tr><td><b>Registered:</b></td><td><%= H(rec[2]) %></td></tr>
<tr><td><b>Expires:</b></td><td><%= H(rec[3]) %></td></tr>
<tr><td><b>Name server:</b></td><td><%= H(here) %> (SimDNS)</td></tr>
</table>

<h3>Records</h3>
<% IF rows = "" THEN %>
<p>No records yet, so <%= H(d) %> doesn't lead anywhere. Add a CNAME to the machine your pages are on,
or press <b>Host it here</b> below.</p>
<% ELSE %>
<table cellpadding="4" border="1" cellspacing="0">
<tr bgcolor="#CCCCFF"><th>Name</th><th>Type</th><th>Points at</th><th>&nbsp;</th></tr>
<%= rows %>
</table>
<% END IF %>
<form action="record.asp" method="post">
<%= TokenField() %><input type="hidden" name="d" value="<%= H(d) %>"><input type="hidden" name="op" value="add">
<table cellpadding="3" bgcolor="#EEEEFF"><tr><td>
<input name="name" size="10" value="www">.<%= H(d) %>
<select name="type"><option value="CNAME" selected>CNAME</option><option value="A">A</option><option value="MX">MX</option><option value="TXT">TXT</option><option value="NS">NS</option></select>
<input name="value" size="24" value="<%= H(here) %>">
<input type="submit" value="Add Record">
</td></tr></table>
</form>
<p><font size="2"><b>CNAME</b> points a name at a SIM95 machine (<tt><%= H(here) %></tt>) or at another name.
Use <tt>@</tt> for <%= H(d) %> itself. <b>A</b> takes an address, but addresses change when a machine restarts,
so CNAME is the one to use. <b>MX</b> names your mail machine (<tt>10 <%= H(here) %></tt>). <b>TXT</b> is a line of text. <b>NS</b> hands a part of your domain (<tt>east</tt>) to the SimDNS on another machine.</font></p>

<h3>Web site</h3>
<% IF folder <> "" THEN %>
<p><%= H(d) %> is hosted here, in <tt><%= H(folder) %></tt>. Its addresses:</p>
<p><%= Addresses(d) %></p>
<p><font size="2">Put your pages in that folder (Files, Notes or <tt>scp</tt>). Use relative links (<tt>href="page.htm"</tt>), so they work at both addresses.</font></p>
<% ELSE %>
<form action="hostit.asp" method="post"><%= TokenField() %><input type="hidden" name="d" value="<%= H(d) %>">
<p><input type="submit" value="Host it here"> - a folder for your pages on <%= H(here) %>, and <tt><%= H(d) %></tt> and <tt>www.<%= H(d) %></tt> pointed at it.</p>
</form>
<% END IF %>
<% IF apps.Count > 0 THEN %>
<h3>Your apps on <%= H(here) %></h3>
<p>This machine runs several web apps, each in a folder. SimNIC can give each a name of its own in your domain:</p>
<ul><%= names %></ul>
<form action="apps.asp" method="post"><%= TokenField() %><input type="hidden" name="d" value="<%= H(d) %>">
<input type="submit" value="Point these names at the apps"></form>
<% END IF %>
<%= Bottom() %>
