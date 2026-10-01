<%@ import file="BOOK.SPK" %>
<%
' PHOTOS.ASP?u=name - someone's photos, newest first; on your own, a form to add
' one. Each photo is a post, so it lands in the feed and takes thumbs and replies.
VAR who AS String
VAR rec AS Array OF String
VAR ids AS Array OF String
VAR problem AS String
VAR line AS String
VAR i AS Integer
VAR shown AS Integer
VAR cells AS String
RequireLogin()
who = viewer
IF REQUEST.Query("u") <> "" THEN who = CleanName(REQUEST.Query("u"))
IF NOT UserExists(who) THEN RESPONSE.Redirect("people.asp")
IF REQUEST.Method = "POST" THEN
    RequireToken()
    who = viewer
    problem = AddPhoto(viewer, REQUEST.Form("pic"), REQUEST.Form("caption"))
    IF problem = "" THEN RESPONSE.Redirect("photos.asp?u=" + viewer)
END IF
rec = LoadUser(who)
ids = Album(who)
' Two to a row, newest first, as many as fit
FOR i = ids.Count - 1 TO 0 STEP -1
    line = FindPost(ids[i])
    IF line <> "" THEN
        IF shown MOD 2 = 0 THEN cells = cells + "<tr>"
        cells = cells + "<td valign=""top"" width=""50%""><a href=""view.asp?id=" + ids[i] + """><img src=""photos/" + ids[i] + ".pic"" alt=""photo""></a><br><font size=""2"">" + Br(Unesc(line.Split("|")[6])) + "</font><br><font size=""1"" color=""#808080"">" + line.Split("|")[1] + " &middot; <a href=""view.asp?id=" + ids[i] + """>" + Str(Replies(ids[i]).Count) + " replies</a></font></td>"
        shown = shown + 1
        IF shown MOD 2 = 0 THEN cells = cells + "</tr>"
        IF shown >= ALBUMSHOW OR cells.Length > PAGEROOM THEN BREAK
    END IF
NEXT
IF shown MOD 2 = 1 THEN cells = cells + "<td></td></tr>"
%>
<%= Top("Photos") %>
<table width="100%" cellpadding="8" cellspacing="0"><tr><td valign="top">
<h2><font color="#3B5998"><a href="profile.asp?u=<%= who %>"><%= H(Field(rec, "name")) %></a>'s Photos</font></h2>
<%= Notice(problem) %>
<% IF who = viewer THEN %>
<%= BoxTop("Add a Photo") %>
<form action="photos.asp" method="post"><%= TokenField() %>
<p><font size="2">Photo:</font> <input type="file" name="pic" size="30"><br>
<font size="2">Caption:</font> <input name="caption" size="40" maxlength="<%= MAXCAPTION %>"><br>
<input type="submit" value="Add Photo"></p>
</form>
<p><font size="1" color="#808080">A .PIC file of up to <%= PHOTOSIZE %> by <%= PHOTOSIZE %>. To fit a Sketch drawing, run
<a href="picture.asp">SHRINK.SPK</a> on it with the size 200: it saves PHOTO.PIC, 200 by 150.</font></p>
<% END IF %>
<%= BoxTop("Photos (" + Str(ids.Count) + ")") %>
<% IF shown = 0 THEN %>
<p><font size="2" color="#808080">No photos yet.</font></p>
<% ELSE %>
<table width="100%" cellpadding="6" cellspacing="4"><%= cells %></table>
<% IF shown < ids.Count THEN %><p><font size="1" color="#808080">The newest <%= shown %> of <%= ids.Count %>.</font></p><% END IF %>
<% END IF %>
</td></tr></table>
<%= Bottom() %>
