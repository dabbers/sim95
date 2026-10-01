<%@ import file="GEO.SPK" %>
<%
' UPLOAD.ASP - add a picture to your homepage, or take one away, and the clip
' art everybody may use. A page of its own, because a whole request must fit
' in one 64K network message: a picture that is too big fails in Voyager.
VAR home AS String
VAR hood AS String
VAR num AS String
VAR problem AS String
VAR said AS String
VAR pname AS String
VAR one AS String
VAR art AS String
RequireLogin()
home = HomeOf(viewer)
hood = home.Split("|")[0]
num = home.Split("|")[1]
IF REQUEST.Method = "POST" THEN
    RequireToken()
    IF REQUEST.Form("del") <> "" THEN
        pname = REQUEST.Form("del").Lower()
        IF ValidPage(pname) AND FS.Exists(SiteWeb(hood, num) + "\" + pname.Upper() + ".PIC") THEN FS.Delete(SiteWeb(hood, num) + "\" + pname.Upper() + ".PIC")
        RESPONSE.Redirect("upload.asp?why=" + UrlEnc("The picture is gone."))
    END IF
    pname = REQUEST.Form("name").Trim()
    IF pname = "" THEN pname = REQUEST.Form("pic.filename").Split("\")[REQUEST.Form("pic.filename").Split("\").Count - 1]
    problem = SavePicture(hood, num, pname, REQUEST.Form("pic"))
    IF problem = "" THEN RESPONSE.Redirect("upload.asp?why=" + UrlEnc("Got it! Put it on a page with <img src=""" + pname.Lower().Replace(".pic", "") + ".pic"">"))
ELSE
    said = REQUEST.Query("why")
END IF
%>
<%= Top("Add a Picture", "Add pictures to your GeoSimies homepage.") %>
<table width="100%" cellpadding="8" cellspacing="0"><tr><td valign="top">
<%= Notice(problem) %><%= Notice(said) %>
<%= BoxTop("Add a Picture", "#008000") %>
<form action="upload.asp" method="post"><%= TokenField() %>
<p><input type="file" name="pic" size="30"></p>
<p><font size="2">Call it</font> <input name="name" size="8"> <font size="1" color="#808080">(1 to 8 letters or digits; empty: the file's own name)</font>
<input type="submit" value="Upload"></p>
</form>
<p><font size="2">A picture is a .PIC file from Sketch, up to <%= PICSIZE %> by <%= PICSIZE %> and <%= MAXPIC / 1000 %>K.
Voyager can't send anything over 64K, and Sketch saves 400 by 300, so shrink a Sketch
picture first (SimBook's SHRINK.SPK does it). You have room for <%= MAXPICS %> pictures.</font></p>
<%= BoxTop("My Pictures", "#000080") %>
<table cellpadding="4">
<% FOR EACH one IN Pictures(hood, num) %>
<tr><td><img src="<%= SiteLink(hood, num) + one %>" alt="<%= one %>"></td>
<td><font size="2"><tt>&lt;img src="<%= one %>"&gt;</tt></font></td>
<td><form action="upload.asp" method="post"><%= TokenField() %><input type="hidden" name="del" value="<%= one.Replace(".pic", "") %>"><input type="submit" value="Delete"></form></td></tr>
<% NEXT %>
</table>
<% IF Pictures(hood, num).Count = 0 THEN %><p><font size="2" color="#808080">No pictures yet.</font></p><% END IF %>
</td><td width="330" valign="top">
<%= BoxTop("Free Clip Art!", "#800000") %>
<p><font size="2">Help yourself. Copy the line under a picture into your page.</font></p>
<table cellpadding="4">
<% FOR EACH art IN ClipArt() %>
<tr><td><img src="clipart/<%= art.Split("|")[0] %>.pic" alt="<%= art.Split("|")[1] %>"><br>
<font size="1"><%= art.Split("|")[1] %>: <tt>&lt;img src="../../clipart/<%= art.Split("|")[0] %>.pic"&gt;</tt></font></td></tr>
<% NEXT %>
</table>
</td></tr></table>
<%= Bottom() %>
