<%@ import file="BOOK.SPK" %>
<%
' PHOTOS.ASP - SimBook no longer takes photos (nothing a stranger draws is
' kept on this machine). Old links to an album lead to the member's profile.
VAR who AS String
who = CleanName(REQUEST.Query("u"))
IF who = "" OR NOT UserExists(who) THEN RESPONSE.Redirect("home.asp")
RESPONSE.Redirect("profile.asp?u=" + who)
%>
