<%@ import file="PAL.SPK" %>
<%
' JOIN.ASP - opens a new account (with its welcome bonus) and signs it in.
VAR u AS String
VAR problem AS String
VAR nextPage AS String
IF REQUEST.Method <> "POST" THEN RESPONSE.Redirect("index.asp")
u = REQUEST.Form("u").Trim().Lower()
nextPage = REQUEST.Form("next")
IF NOT nextPage.StartsWith("pay.asp?") OR nextPage.Contains(Chr(10)) THEN nextPage = "home.asp?new=1"
IF REQUEST.Form("pw") <> REQUEST.Form("pw2") THEN
    problem = "The two passwords are different."
ELSE
    problem = CreateUser(u, REQUEST.Form("pw"), REQUEST.Form("name"))
END IF
IF problem <> "" THEN RESPONSE.Redirect("index.asp?e=join&why=" + UrlEnc(problem) + "&next=" + UrlEnc(REQUEST.Form("next")))
SignIn(u)
RESPONSE.Redirect(nextPage)
%>
