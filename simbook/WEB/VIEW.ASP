<%@ import file="BOOK.SPK" %>
<%
' VIEW.ASP?id=N - one post with all its replies (as many as fit), and a reply box.
VAR id AS String
VAR line AS String
RequireLogin()
id = REQUEST.Query("id")
line = FindPost(id)
IF line = "" THEN RESPONSE.Redirect("home.asp")
%>
<%= Top("Post") %>
<table width="100%" cellpadding="8" cellspacing="0"><tr><td valign="top">
<%= Notice(REQUEST.Query("why")) %>
<%= BoxTop("Post") %>
<table width="100%" cellpadding="5" cellspacing="2">
<%= PostHtml(line, FALSE, "view", 0) %>
</table>
<% IF CanTalk(viewer, line) THEN %>
<%= BoxTop("Reply") %>
<form action="reply.asp" method="post"><%= TokenField() %>
<input type="hidden" name="id" value="<%= id %>">
<p><%= LimitedBox("text", "", 3, 50, MAXREPLY) %><br>
<input type="submit" id="go" value="Reply"></p>
</form>
<%= LimitScript("text", Str(MAXREPLY)) %>
<% ELSE %>
<p><font size="2" color="#808080">Only friends can reply to this.</font></p>
<% END IF %>
</td></tr></table>
<%= Bottom() %>
