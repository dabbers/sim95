<%@ import file="MAIL.SPK" %>
<%
' LOGIN.ASP - checks the password and opens the Inbox.
VAR u AS String
IF REQUEST.Method <> "POST" THEN RESPONSE.Redirect("index.asp")
u = REQUEST.Form("u").Trim().Lower()
IF NOT CheckPassword(u, REQUEST.Form("pw")) THEN RESPONSE.Redirect("index.asp?e=login")
SignIn(u)
RESPONSE.Redirect("inbox.asp")
%>
