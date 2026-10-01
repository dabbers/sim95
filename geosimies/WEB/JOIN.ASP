<%@ import file="GEO.SPK" %>
<%
' JOIN.ASP - makes a new member, moves them in, and signs them in.
VAR u AS String
VAR problem AS String
IF REQUEST.Method <> "POST" THEN RESPONSE.Redirect("signup.asp")
u = REQUEST.Form("u").Trim().Lower()
IF REQUEST.Form("pw") <> REQUEST.Form("pw2") THEN
    problem = "The two passwords are different."
ELSE
    problem = CreateMember(u, REQUEST.Form("pw"), REQUEST.Form("name"), REQUEST.Form("h"), REQUEST.Form("n"), REQUEST.Form("title"), REQUEST.Form("tpl"))
END IF
IF problem <> "" THEN RESPONSE.Redirect("signup.asp?h=" + UrlEnc(REQUEST.Form("h").Lower()) + "&why=" + UrlEnc(problem))
SignIn(u)
RESPONSE.Redirect("edit.asp?new=1")
%>
