<%@ import file="TRACK.SPK" %>
<%@ import file="STATS.SPK" %>
<%
' LOGIN.ASP - checks the password, hands out a session cookie, and goes home.
VAR u AS String
IF REQUEST.Method <> "POST" THEN RESPONSE.Redirect("index.asp")
u = CleanName(REQUEST.Form("u"))
IF u = "" OR NOT CheckPassword(u, REQUEST.Form("pw")) THEN RESPONSE.Redirect("index.asp?e=login")
SignIn(u)
RESPONSE.Redirect("index.asp")
%>
