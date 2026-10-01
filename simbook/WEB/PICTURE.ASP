<%@ import file="BOOK.SPK" %>
<%
' PICTURE.ASP - upload or remove your profile picture. It has a page of its own
' because a whole request must fit in one 64K network message: a picture that is
' too big fails in Voyager before it ever reaches us, and should not take the rest
' of your profile edits down with it.
VAR pic AS String
VAR problem AS String
RequireLogin()
IF REQUEST.Method = "POST" THEN
    RequireToken()
    IF REQUEST.Form("remove") <> "" THEN
        IF HasPicture(viewer) THEN FS.Delete(PicDir() + "\" + viewer + ".PIC")
        RESPONSE.Redirect("profile.asp?u=" + viewer)
    END IF
    pic = REQUEST.Form("pic")
    problem = SavePicture(viewer, pic)
    IF problem = "" THEN RESPONSE.Redirect("profile.asp?u=" + viewer)
END IF
%>
<%= Top("My Picture") %>
<table width="100%" cellpadding="8" cellspacing="0"><tr>
<td width="200" valign="top"><%= Picture(viewer) %></td>
<td valign="top">
<%= Notice(problem) %>
<%= BoxTop("Upload a Picture") %>
<form action="picture.asp" method="post"><%= TokenField() %>
<p><input type="file" name="pic" size="30"> <input type="submit" value="Upload"></p>
</form>
<p><font size="2">A picture is a .PIC file of up to 100 by 100. Sketch saves bigger ones
(400 by 300, about 120K), and Voyager cannot send anything over 64K, so shrink a
Sketch picture first:</font></p>
<ol><font size="2">
<li>Draw yourself in Sketch and save it, say as <tt>C:\MYFILES\ME.PIC</tt>.</li>
<li>Copy the program below into SPARK, save it as <tt>C:\MYFILES\SHRINK.SPK</tt> and press F5.</li>
<li>Give it <tt>C:\MYFILES\ME.PIC</tt> and the size 100. It saves <tt>C:\MYFILES\AVATAR.PIC</tt>, 100 by 75.
(The size 200 makes <tt>PHOTO.PIC</tt>, 200 by 150, for your <a href="photos.asp">photos</a>.)</li>
<li>Upload <tt>AVATAR.PIC</tt> here.</li>
</font></ol>
<form><textarea rows="12" cols="70" readonly><%= H(ReadOr(AppDir() + "\SHRINK.SPK", "")) %></textarea></form>
<% IF HasPicture(viewer) THEN %>
<%= BoxTop("Remove My Picture") %>
<form action="picture.asp" method="post"><%= TokenField() %>
<input type="hidden" name="remove" value="1">
<p><input type="submit" value="Remove My Picture"></p>
</form>
<% END IF %>
</td>
</tr></table>
<%= Bottom() %>
