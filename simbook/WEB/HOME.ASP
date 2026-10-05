<%@ import file="BOOK.SPK" %>
<%
' HOME.ASP - the News Feed: what you and your friends have been writing.
VAR rec AS Array OF String
VAR pokers AS Array OF String
VAR who AS String
RequireLogin()
rec = LoadUser(viewer)
pokers = PokesOf(viewer).Split("|")
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
<% IF PokesOf(viewer) <> "|" THEN %>
<%= BoxTop("Pokes") %>
<table cellpadding="3">
<% FOR EACH who IN pokers
     IF who = "" OR NOT UserExists(who) THEN CONTINUE %>
<tr><td><font size="2"><a href="profile.asp?u=<%= who %>"><b><%= H(NameOf(who)) %></b></a> poked you.
<a href="poke.asp?u=<%= who %>&do=poke&<%= TokenArg() %>">poke back</a> &middot;
<a href="poke.asp?u=<%= who %>&do=clear&<%= TokenArg() %>">remove</a></font></td></tr>
<% NEXT %>
</table>
<% END IF %>
<%= BoxTop("What are you doing right now?") %>
<form action="post.asp" method="post"><%= TokenField() %>
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
