<%@ import file="BOOK.SPK" %>
<%
' PROFILE.ASP?u=name - one member's page: picture, information, friends and Wall.
VAR who AS String
VAR rec AS Array OF String
VAR pals AS Array OF String
VAR pal AS String
VAR shown AS Integer
VAR mine AS Bool
VAR friend AS Bool
RequireLogin()
who = viewer
IF REQUEST.Query("u") <> "" THEN who = CleanName(REQUEST.Query("u"))
IF NOT UserExists(who) THEN RESPONSE.Redirect("people.asp")
rec = LoadUser(who)
pals = Friends(who)
mine = (who = viewer)
friend = IsFriend(viewer, who)
%>
<%= Top(Field(rec, "name")) %>
<table width="100%" cellpadding="8" cellspacing="0"><tr>
<td width="200" valign="top">
<%= Picture(who) %>
<% IF mine THEN %>
<p><font size="2"><a href="edit.asp">Edit My Profile</a></font></p>
<% ELSE %>
<form action="friend.asp" method="post">
<input type="hidden" name="u" value="<%= who %>">
<% IF friend THEN %>
<p><font size="2"><%= H(Field(rec, "name")) %> is your friend.</font><br>
<input type="hidden" name="do" value="remove"><input type="submit" value="Remove from Friends"></p>
<% ELSE %>
<input type="hidden" name="do" value="add"><p><input type="submit" value="Add to Friends"></p>
<% END IF %>
</form>
<% END IF %>
<a name="friends"></a>
<%= BoxTop("Friends (" + Str(pals.Count) + ")") %>
<font size="2">
<% FOR EACH pal IN pals %>
<a href="profile.asp?u=<%= pal %>"><%= H(NameOf(pal)) %></a><br>
<%   shown = shown + 1
     IF shown >= 20 THEN BREAK
   NEXT %>
<% IF pals.Count = 0 THEN %><font color="#808080">No friends yet.</font><% END IF %>
</font>
</td>
<td valign="top">
<%= Notice(REQUEST.Query("why")) %>
<h2><font color="#3B5998"><%= H(Field(rec, "name")) %></font></h2>
<%= BoxTop("Information") %>
<table cellpadding="3">
<tr><td width="120"><font size="2" color="#808080">User name:</font></td><td><font size="2"><%= who %></font></td></tr>
<tr><td><font size="2" color="#808080">Member since:</font></td><td><font size="2"><%= H(Field(rec, "joined")) %></font></td></tr>
<% IF Field(rec, "sex") <> "" THEN %><tr><td><font size="2" color="#808080">Sex:</font></td><td><font size="2"><%= H(Field(rec, "sex")) %></font></td></tr><% END IF %>
<% IF Field(rec, "birthday") <> "" THEN %><tr><td><font size="2" color="#808080">Birthday:</font></td><td><font size="2"><%= H(Field(rec, "birthday")) %></font></td></tr><% END IF %>
<% IF Field(rec, "hometown") <> "" THEN %><tr><td><font size="2" color="#808080">Hometown:</font></td><td><font size="2"><%= H(Field(rec, "hometown")) %></font></td></tr><% END IF %>
<% IF Field(rec, "status") <> "" THEN %><tr><td><font size="2" color="#808080">Relationship:</font></td><td><font size="2"><%= H(Field(rec, "status")) %></font></td></tr><% END IF %>
<% IF Field(rec, "interests") <> "" THEN %><tr><td valign="top"><font size="2" color="#808080">Interests:</font></td><td><font size="2"><%= Br(Field(rec, "interests")) %></font></td></tr><% END IF %>
<% IF Field(rec, "music") <> "" THEN %><tr><td valign="top"><font size="2" color="#808080">Favorite Music:</font></td><td><font size="2"><%= Br(Field(rec, "music")) %></font></td></tr><% END IF %>
<% IF Field(rec, "about") <> "" THEN %><tr><td valign="top"><font size="2" color="#808080">About Me:</font></td><td><font size="2"><%= Br(Field(rec, "about")) %></font></td></tr><% END IF %>
</table>
<%= BoxTop("The Wall") %>
<% IF mine OR friend THEN %>
<form action="post.asp" method="post">
<input type="hidden" name="to" value="<%= who %>">
<p><textarea name="text" rows="3" cols="50"></textarea><br>
<input type="submit" value="<% IF mine THEN %>Share<% ELSE %>Write on the Wall<% END IF %>"></p>
</form>
<% ELSE %>
<p><font size="2" color="#808080">Only <%= H(Field(rec, "name")) %>'s friends can write on this Wall.</font></p>
<% END IF %>
<table width="100%" cellpadding="5" cellspacing="2">
<%= WallHtml(who) %>
</table>
</td>
</tr></table>
<%= Bottom() %>
