<%@ import file="BOOK.SPK" %>
<%
' REPLY.ASP - adds a reply to a post, then shows the post again.
VAR id AS String
VAR problem AS String
RequireLogin()
RequireToken()
IF REQUEST.Method <> "POST" THEN RESPONSE.Redirect("home.asp")
id = REQUEST.Form("id")
problem = AddReply(viewer, id, REQUEST.Form("text"))
IF FindPost(id) = "" THEN RESPONSE.Redirect("home.asp")
IF problem <> "" THEN RESPONSE.Redirect("view.asp?id=" + id + "&why=" + UrlEnc(problem))
RESPONSE.Redirect("view.asp?id=" + id)
%>
