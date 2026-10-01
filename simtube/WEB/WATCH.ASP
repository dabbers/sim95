<%@ import file="TUBE.SPK" %>
<%
' WATCH.ASP?v=N - one movie: its picture and details, where to play it, stars and comments.
' Simxplorer plays the movie itself (SimPlayer is built in); Voyager can't, so
' this page also hands over its address for SimPlayer on its own.
VAR id AS String
VAR line AS String
VAR all AS Array OF String
VAR i AS Integer
VAR mine AS Integer
viewer = CurrentUser()
id = REQUEST.Query("v")
line = FindVideo(id)
IF line = "" THEN RESPONSE.Redirect("index.asp")
' coming back from rating or commenting is not another view
IF REQUEST.Query("back") = "" THEN AddView(id)
all = Comments(id)
IF viewer <> "" THEN mine = MyRating(id, viewer)
%>
<%= Top(VTitle(line)) %>
<table width="100%" cellpadding="8" cellspacing="0"><tr><td valign="top">
<%= Notice(REQUEST.Query("why")) %>
<h2><%= H(VTitle(line)) %></h2>
<table cellpadding="6" cellspacing="0"><tr>
<td valign="top" bgcolor="#000000"><img src="thumb.asp?v=<%= id %>" alt="<%= H(VTitle(line)) %>"></td>
<td valign="top"><font size="2">
From: <b><%= H(NameOf(VF(line, 1))) %></b><br>
<% IF VF(line, 11) <> "" THEN %>Made by: <%= H(Unesc(VF(line, 11))) %><br><% END IF %>
Added: <%= VF(line, 3) %><br>
Runs: <%= RunTime(line) %> (<%= VF(line, 4) %> frames at <%= VF(line, 5) %> a second, <%= VF(line, 6) %>x<%= VF(line, 7) %>)<br>
Views: <b><%= Views(id) %></b><br>
Rating: <%= Stars(Rating(id)) %> (<%= Plural(RatingCount(id), "rating", "ratings") %>)
</font></td>
</tr></table>
<% IF VF(line, 10) <> "" THEN %><p><%= Br(Unesc(VF(line, 10))) %></p><% END IF %>

<%= BoxTop("Watch It") %>
<p><font size="4"><b><a href="movie.asp?v=<%= id %>" type="<%= MIME %>">&gt; Play Movie</a></b></font>
<font size="2">(<%= Plural(Int(Val(VF(line, 8))), "part", "parts") %>)</font></p>
<p><font size="2">In <b>Simxplorer</b>, click Play: SimPlayer is built in, and pops up to play it.
In Voyager, use <b>SimPlayer</b> on its own (<a href="getplay.asp">get it from Vapor</a>): paste this
address into its Address box and press Enter. It starts as soon as the first part is in.</font></p>
<form><input id="url" size="56" value="<%= H(MovieUrl(id)) %>" readonly></form>
<p><font size="2">(a <tt><%= MIME %></tt> SimMovie) &middot; From SPARK:
<tt>SYS.Start("C:\PROGRAMS\PLAYER.SPK", "<%= H(MovieUrl(id)) %>")</tt></font></p>

<%= BoxTop("Rate This Movie") %>
<% IF viewer <> "" THEN %>
<form action="rate.asp" method="post"><%= TokenField() %>
<input type="hidden" name="v" value="<%= id %>">
<p><font size="2">Your rating:
<select name="stars">
<% FOR i = 5 TO 1 STEP -1 %><option value="<%= i %>"<% IF i = mine THEN %> selected<% END IF %>><%= "*****".Substring(0, i) %> (<%= i %>)</option><% NEXT %>
</select> <input type="submit" value="Rate"></font></p>
</form>
<% ELSE %>
<p><font size="2"><a href="index.asp#login">Log in</a> to rate and comment.</font></p>
<% END IF %>

<a name="comments"></a>
<%= BoxTop("Comments (" + Str(all.Count) + ")") %>
<% IF viewer <> "" THEN %>
<form action="comment.asp" method="post"><%= TokenField() %>
<input type="hidden" name="v" value="<%= id %>">
<p><textarea name="text" rows="3" cols="50"></textarea><br>
<font size="1" color="#808080">Up to <%= MAXCOMMENT %> characters.</font>
<input type="submit" value="Post Comment"></p>
</form>
<% END IF %>
<table width="100%" cellpadding="4" cellspacing="2">
<%= CommentsHtml(all) %>
</table>

<% IF viewer = VF(line, 1) THEN %>
<%= BoxTop("Add More Frames") %>
<form action="upload.asp" method="post"><%= TokenField() %>
<input type="hidden" name="to" value="<%= id %>">
<p><font size="2">A movie over 60K goes up in pieces. Send the next piece of the .SMV file
(the frame lines that come next; a header at the top is fine) and it is added to the end.</font><br>
<input type="file" name="movie" size="30"> <input type="submit" value="Add Frames"></p>
</form>
<% END IF %>
</td></tr></table>
<%= Bottom() %>
