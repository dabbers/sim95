<%@ import file="MAIL.SPK" %>
<%
' READ.ASP?f=inbox|sent&n=N - one letter. Opening it marks it read.
VAR f AS String
VAR n AS String
VAR line AS String
VAR letter AS String
RequireLogin()
f = REQUEST.Query("f")
IF f <> "sent" THEN f = "inbox"
n = REQUEST.Query("n")
line = FindIndex(viewer, f, n)
IF line = "" THEN RESPONSE.Redirect("inbox.asp?f=" + f)
letter = LoadLetter(viewer, n)
IF f = "inbox" THEN MarkRead(viewer, line)
%>
<%= Top(Header(letter, "Subject")) %>
<table width="100%" cellpadding="8" cellspacing="0"><tr><td valign="top">
<%= BoxTop(H(Header(letter, "Subject"))) %>
<table cellpadding="3">
<tr><td><font size="2" color="#808080">From:</font></td><td><font size="2"><b><%= H(Header(letter, "From")) %></b></font></td></tr>
<tr><td><font size="2" color="#808080">To:</font></td><td><font size="2"><%= H(Header(letter, "To")) %></font></td></tr>
<tr><td><font size="2" color="#808080">Date:</font></td><td><font size="2"><%= H(Header(letter, "Date")) %></font></td></tr>
<% IF Header(letter, "Received") <> "" THEN %><tr><td><font size="2" color="#808080">Received:</font></td><td><font size="1"><%= H(Header(letter, "Received")) %></font></td></tr><% END IF %>
</table>
<hr>
<pre><%= HtmlUpTo(Body(letter), PAGEROOM) %></pre>
<hr>
<table cellpadding="4"><tr>
<td><form action="compose.asp" method="get"><input type="hidden" name="reply" value="<%= n %>"><input type="hidden" name="f" value="<%= f %>"><input type="submit" value="Reply"></form></td>
<td><form action="compose.asp" method="get"><input type="hidden" name="fwd" value="<%= n %>"><input type="hidden" name="f" value="<%= f %>"><input type="submit" value="Forward"></form></td>
<td><form action="delete.asp" method="post"><%= TokenField() %><input type="hidden" name="f" value="<%= f %>"><input type="hidden" name="d<%= n %>" value="1"><input type="submit" value="Delete"></form></td>
<td><font size="2"><a href="inbox.asp?f=<%= f %>">Back to <% IF f = "sent" THEN %>Sent<% ELSE %>Inbox<% END IF %></a></font></td>
</tr></table>
</td></tr></table>
<%= Bottom() %>
