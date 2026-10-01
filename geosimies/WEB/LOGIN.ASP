<%@ import file="GEO.SPK" %>
<%
' LOGIN.ASP - checks the password, hands out a session cookie, and goes to the editor.
VAR u AS String
IF REQUEST.Method <> "POST" THEN RESPONSE.Redirect("index.asp")
u = CleanName(REQUEST.Form("u"))
IF u = "" OR NOT CheckPassword(u, REQUEST.Form("pw")) THEN RESPONSE.Redirect("index.asp?e=bad")
SignIn(u)
RESPONSE.Redirect("edit.asp")
%>
