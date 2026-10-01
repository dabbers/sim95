<%@ import file="TUBE.SPK" %>
<%
' COMMENT.ASP - adds a comment under a movie, then goes back to it.
VAR line AS String
VAR problem AS String
RequireLogin()
RequireToken()
IF REQUEST.Method <> "POST" THEN RESPONSE.Redirect("index.asp")
line = FindVideo(REQUEST.Form("v"))
IF line = "" THEN RESPONSE.Redirect("index.asp")
problem = AddComment(VF(line, 0), viewer, REQUEST.Form("text"))
IF problem <> "" THEN RESPONSE.Redirect("watch.asp?back=1&v=" + VF(line, 0) + "&why=" + UrlEnc(problem))
RESPONSE.Redirect("watch.asp?back=1&v=" + VF(line, 0))
%>
