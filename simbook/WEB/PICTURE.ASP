<%@ import file="BOOK.SPK" %>
<%
' PICTURE.ASP - choose your picture from SimBook's stock ones (AV01.PIC to
' AV20.PIC). SimBook takes no uploaded pictures: nothing a stranger draws is
' ever kept on this machine.
VAR n AS Integer
VAR mine AS Integer
VAR i AS Integer
VAR here AS String
VAR pics AS String
VAR parts AS Array OF String
RequireLogin()
IF REQUEST.Method = "POST" THEN
    RequireToken()
    n = Int(Val(REQUEST.Form("avatar")))
    IF n >= 1 AND n <= AVATARS THEN SetAvatar(viewer, n)
    RESPONSE.Redirect("profile.asp?u=" + viewer)
END IF
mine = AvatarOf(viewer)
' Voyager asks for a page's pictures all at once, and lookups of one name at
' once are lost, so twenty pictures come by this machine's address (see
' SIM95-NOTES.md); behind SimHost (X-Base-Path) they come the usual way.
parts = REQUEST.Path.Split("/")
here = REQUEST.Path.Substring(0, REQUEST.Path.Length - parts[parts.Count - 1].Length)
IF REQUEST.Header("X-Base-Path") = "" AND NET.LocalAddress <> "" THEN pics = "http://" + NET.LocalAddress + here
%>
<%= Top("My Picture") %>
<table width="100%" cellpadding="8" cellspacing="0"><tr>
<td width="120" valign="top"><%= Picture(viewer) %></td>
<td valign="top">
<%= BoxTop("Choose a Picture") %>
<p><font size="2">Pick the one you like and click <b>Use This Picture</b>.</font></p>
<form action="picture.asp" method="post"><%= TokenField() %>
<table cellpadding="4" cellspacing="0"><tr>
<% FOR i = 1 TO AVATARS %><td align="center" valign="top"<% IF i = mine THEN %> bgcolor="#3B5998"<% END IF %>><img src="<%= pics %><%= AvatarFile(i) %>" width="80" height="80" alt="picture <%= i %>"><br>
<input type="radio" name="avatar" value="<%= i %>"<% IF i = mine THEN %> checked<% END IF %>></td><% IF i MOD 5 = 0 AND i < AVATARS THEN %></tr><tr><% END IF %><% NEXT %>
</tr></table>
<p><input type="submit" value="Use This Picture"></p>
</form>
<p><font size="1" color="#808080">SimBook doesn't take uploaded pictures or photos.</font></p>
</td>
</tr></table>
<%= Bottom() %>
