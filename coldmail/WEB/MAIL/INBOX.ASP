<%@ import file="MAIL.SPK" %>
<%
' INBOX.ASP?f=inbox|sent - a folder, newest first, with boxes to tick for deleting.
VAR f AS String
VAR lines AS Array OF String
VAR p AS Array OF String
VAR rows AS String
VAR i AS Integer
VAR shown AS Integer
VAR who AS String
RequireLogin()
f = REQUEST.Query("f")
IF f <> "sent" THEN f = "inbox"
lines = Folder(viewer, f)
FOR i = lines.Count - 1 TO 0 STEP -1
    p = lines[i].Split("|")
    IF p.Count < 7 THEN CONTINUE
    IF f = "sent" THEN
        who = "To: " + Unesc(p[3])
    ELSE
        who = DisplayName(Unesc(p[2]))
    END IF
    IF p[6] = "N" THEN
        rows = rows + "<tr bgcolor=""#EEF4FF""><td><input type=""checkbox"" name=""d" + p[0] + """></td><td><font size=""2""><b>" + H(Clip(who, 40)) + "</b></font></td><td><font size=""2""><a href=""read.asp?f=" + f + "&n=" + p[0] + """><b>" + H(Unesc(p[4])) + "</b></a></font></td><td><font size=""1"">" + p[1] + "</font></td><td align=""right""><font size=""1"">" + Str(Int(Val(p[5]) / 1024) + 1) + "K</font></td></tr>"
    ELSE
        rows = rows + "<tr><td><input type=""checkbox"" name=""d" + p[0] + """></td><td><font size=""2"">" + H(Clip(who, 40)) + "</font></td><td><font size=""2""><a href=""read.asp?f=" + f + "&n=" + p[0] + """>" + H(Unesc(p[4])) + "</a></font></td><td><font size=""1"">" + p[1] + "</font></td><td align=""right""><font size=""1"">" + Str(Int(Val(p[5]) / 1024) + 1) + "K</font></td></tr>"
    END IF
    shown = shown + 1
    IF rows.Length > PAGEROOM OR shown >= 100 THEN BREAK
NEXT
%>
<%= Top("Inbox") %>
<table width="100%" cellpadding="8" cellspacing="0"><tr><td valign="top">
<%= ServerWarning() %>
<%= Notice(REQUEST.Query("why")) %>
<% IF f = "sent" THEN %>
<%= BoxTop("Sent (" + Str(lines.Count) + ")") %>
<% ELSE %>
<%= BoxTop("Inbox (" + Str(lines.Count) + " letters, " + Str(Unread(viewer)) + " new)") %>
<% END IF %>
<form action="delete.asp" method="post"><%= TokenField() %>
<input type="hidden" name="f" value="<%= f %>">
<% IF rows = "" THEN %>
<p><font size="2" color="#808080">There is nothing in this folder.</font></p>
<% ELSE %>
<table width="100%" cellpadding="3" cellspacing="1">
<tr bgcolor="#DDDDDD"><td></td><td><font size="2"><b><% IF f = "sent" THEN %>To<% ELSE %>From<% END IF %></b></font></td><td><font size="2"><b>Subject</b></font></td><td><font size="2"><b>Date</b></font></td><td><font size="2"><b>Size</b></font></td></tr>
<%= rows %>
</table>
<% IF shown < lines.Count THEN %><p><font size="1" color="#808080">The newest <%= shown %> of <%= lines.Count %> are shown. Delete some to see the rest.</font></p><% END IF %>
<p><input type="submit" value="Delete Ticked"></p>
<% END IF %>
</form>
<p><font size="2"><a href="compose.asp"><b>Compose a letter</b></a> &middot; <a href="inbox.asp?f=<%= f %>">Check for new mail</a></font></p>
</td></tr></table>
<%= Bottom() %>
