<%@ import file="BOOK.SPK" %>
<%
' LOGIN.ASP - checks the password, hands out a session cookie, and moves on.
VAR u AS String
u = CleanName(REQUEST.Form("u"))
IF REQUEST.Method <> "POST" THEN RESPONSE.Redirect("index.asp")
IF u = "" OR NOT CheckPassword(u, REQUEST.Form("pw")) THEN RESPONSE.Redirect("index.asp?e=login")
SignIn(u)
RESPONSE.Redirect("home.asp")
%>
