<%@ import file="BOOK.SPK" %>
<%
' POST.ASP - writes on a Wall (your own Wall is your status), then goes back.
VAR wall AS String
VAR problem AS String
VAR back AS String
RequireLogin()
RequireToken()
IF REQUEST.Method <> "POST" THEN RESPONSE.Redirect("home.asp")
wall = CleanName(REQUEST.Form("to"))
problem = AddPost(viewer, wall, REQUEST.Form("text"))
IF REQUEST.Form("back") = "home" OR wall = "" THEN
    back = "home.asp"
    IF problem <> "" THEN back = back + "?why=" + UrlEnc(problem)
ELSE
    back = "profile.asp?u=" + wall
    IF problem <> "" THEN back = back + "&why=" + UrlEnc(problem)
END IF
RESPONSE.Redirect(back)
%>
