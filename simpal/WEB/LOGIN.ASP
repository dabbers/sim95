<%@ import file="PAL.SPK" %>
<%
' LOGIN.ASP - checks the password, hands out a session cookie, and moves on:
' to the account page, or back to a checkout (next=pay.asp?...).
VAR u AS String
VAR nextPage AS String
IF REQUEST.Method <> "POST" THEN RESPONSE.Redirect("index.asp")
u = CleanName(REQUEST.Form("u"))
nextPage = REQUEST.Form("next")
IF NOT nextPage.StartsWith("pay.asp?") OR nextPage.Contains(Chr(10)) THEN nextPage = "home.asp"
IF u = "" OR NOT CheckPassword(u, REQUEST.Form("pw")) THEN
    IF nextPage = "home.asp" THEN RESPONSE.Redirect("index.asp?e=login")
    RESPONSE.Redirect(nextPage + "&e=login")
END IF
SignIn(u)
RESPONSE.Redirect(nextPage)
%>
