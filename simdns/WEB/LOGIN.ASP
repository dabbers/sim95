<%@ import file="NIC.SPK" %>
<%
' LOGIN.ASP - checks the password, hands out a session cookie, and moves on.
VAR u AS String
IF REQUEST.Method <> "POST" THEN RESPONSE.Redirect("index.asp")
u = REQUEST.Form("u").Trim().Lower()
IF NOT CheckPassword(u, REQUEST.Form("pw")) THEN RESPONSE.Redirect("index.asp?e=login")
SignIn(u)
RESPONSE.Redirect("home.asp")
%>
