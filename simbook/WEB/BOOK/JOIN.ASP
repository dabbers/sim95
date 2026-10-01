<%@ import file="BOOK.SPK" %>
<%
' JOIN.ASP - makes a new account and signs it in.
VAR u AS String
VAR problem AS String
IF REQUEST.Method <> "POST" THEN RESPONSE.Redirect("index.asp")
u = REQUEST.Form("u").Trim().Lower()
IF REQUEST.Form("pw") <> REQUEST.Form("pw2") THEN
    problem = "The two passwords are different."
ELSE
    problem = CreateUser(u, REQUEST.Form("pw"), REQUEST.Form("name"))
END IF
IF problem <> "" THEN RESPONSE.Redirect("index.asp?e=join&why=" + UrlEnc(problem))
SignIn(u)
RESPONSE.Redirect("edit.asp?new=1")
%>
