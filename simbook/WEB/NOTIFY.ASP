<%@ import file="BOOK.SPK" %>
<%
' NOTIFY.ASP - your notifications, newest first. The new ones are highlighted,
' and looking at them marks them read.
VAR lines AS Array OF String
VAR seen AS Integer
VAR i AS Integer
VAR shown AS Integer
VAR out AS String
RequireLogin()
lines = NoteLines(viewer)
seen = SeenNote(viewer)
FOR i = lines.Count - 1 TO 0 STEP -1
    IF lines[i] <> "" THEN
        out = out + NoteHtml(lines[i], Int(Val(lines[i].Split("|")[0])) > seen)
        shown = shown + 1
        IF shown >= NOTESHOW THEN BREAK
    END IF
NEXT
MarkSeen(viewer)
%>
<%= Top("Notifications") %>
<table width="100%" cellpadding="8" cellspacing="0"><tr><td valign="top">
<%= BoxTop("Notifications") %>
<table width="100%" cellpadding="4" cellspacing="1">
<% IF out = "" THEN %>
<tr><td><font size="2" color="#808080">Nothing yet. When somebody writes on your Wall, replies, gives you a thumb, pokes you or adds you as a friend, it shows up here.</font></td></tr>
<% ELSE %>
<%= out %>
<% END IF %>
</table>
</td></tr></table>
<%= Bottom() %>
