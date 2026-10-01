<%@ import file="BOOK.SPK" %>
<%
' HOME.ASP - the News Feed: what you and your friends have been writing.
VAR rec AS Array OF String
RequireLogin()
rec = LoadUser(viewer)
%>
<%= Top("Home") %>
<table width="100%" cellpadding="8" cellspacing="0"><tr>
<td width="140" valign="top" bgcolor="#EDEFF4">
<a href="profile.asp?u=<%= viewer %>"><%= Picture(viewer) %></a><br>
<font size="2"><b><%= H(Field(rec, "name")) %></b><br>
<a href="profile.asp?u=<%= viewer %>">My Profile</a><br>
<a href="edit.asp">Edit My Profile</a><br>
<a href="picture.asp">Change My Picture</a><br>
<a href="profile.asp?u=<%= viewer %>#friends">My Friends (<%= Friends(viewer).Count %>)</a><br>
<a href="people.asp">Find People</a></font>
</td>
<td valign="top">
<%= Notice(REQUEST.Query("why")) %>
<%= BoxTop("What are you doing right now?") %>
<form action="post.asp" method="post">
<input type="hidden" name="to" value="<%= viewer %>">
<input type="hidden" name="back" value="home">
<p><%= LimitedBox("text", "", 3, 50, MAXPOST) %><br>
<input type="submit" id="go" value="Share"></p>
</form>
<%= LimitScript("text", Str(MAXPOST)) %>
<%= BoxTop("News Feed") %>
<table width="100%" cellpadding="5" cellspacing="2">
<%= FeedHtml(viewer) %>
</table>
</td>
</tr></table>
<%= Bottom() %>
