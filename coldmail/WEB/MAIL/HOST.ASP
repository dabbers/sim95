<%@ import file="MAIL.SPK" %>
<%
' HOST.ASP - run ColdMail on your own machine. Hands out GETMAIL.SPK, a small
' program that copies ColdMail from this machine over the web; and sends you
' on to your own webmail once you have it.
VAR there AS String
viewer = CurrentUser()
there = REQUEST.Query("go").Trim().Lower()
IF there <> "" THEN
    IF OnlyFrom(there, "abcdefghijklmnopqrstuvwxyz0123456789.-") AND there.Length <= 40 THEN RESPONSE.Redirect("http://" + there + "/mail/")
END IF
%>
<%= Top("Host ColdMail") %>
<table width="100%" cellpadding="8" cellspacing="0"><tr><td valign="top">
<%= BoxTop("Run ColdMail on your own machine") %>
<p><font size="2">Every SIM95 machine can be a mail server. Yours would give out
addresses like <b>you@yourmachine</b>, keep its own mailboxes, and trade letters with
<%= H(NET.HostName.Lower()) %> and every other ColdMail machine over port 25.</font></p>
<ol><font size="2">
<li>On your machine, open <b>Start &gt; Programs &gt; SPARK</b>.</li>
<li>Copy the program below into it, save it as <tt>C:\MYFILES\GETMAIL.SPK</tt>, and press <b>F5</b>.</li>
<li>It copies ColdMail from <b><%= H(NET.HostName.Lower()) %></b> file by file, starts your mail
server, and sets it to start whenever your machine does.</li>
<li>Then open your own webmail at <tt>http://yourmachine/mail/</tt>.</li>
</font></ol>
<form><textarea rows="14" cols="76" readonly><%= H(ReadOr(SERVER.MapPath("/mail/getmail.txt"), "").Replace("%HOST%", NET.HostName.Lower())) %></textarea></form>
<%= BoxTop("Already running it?") %>
<form action="host.asp" method="get">
<p><font size="2">Your machine's name:</font> <input name="go" size="30" maxlength="40">
<input type="submit" value="Go to my webmail"></p>
</form>
<%= BoxTop("This mail server") %>
<p><font size="2">
<% IF ServerAlive() THEN %>
The mail server on <b><%= H(NET.HostName.Lower()) %></b> is <b><font color="#008000">running</font></b>, port 25.
<% ELSE %>
The mail server on <b><%= H(NET.HostName.Lower()) %></b> is <b><font color="#990000">not running</font></b>; letters wait in the outbox until it starts.
<% END IF %>
<%= Str(Waiting()) %> letter(s) waiting to go out. <a href="index.asp">Use ColdMail here instead</a>.
</font></p>
</td></tr></table>
<%= Bottom() %>
