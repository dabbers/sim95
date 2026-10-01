<%@ import file="BOOK.SPK" %>
<%
' VOTE.ASP?id=N&v=up|down&b=back - thumbs up or down on a post (the same thumb
' again takes it back), then returns to the feed, the post or the Wall it came from.
VAR id AS String
VAR line AS String
VAR back AS String
RequireLogin()
RequireToken()
id = REQUEST.Query("id")
line = FindPost(id)
IF line <> "" AND CanTalk(viewer, line) THEN
    IF REQUEST.Query("v") = "up" THEN Vote(viewer, line, "+")
    IF REQUEST.Query("v") = "down" THEN Vote(viewer, line, "-")
END IF
back = REQUEST.Query("b")
IF back = "view" THEN RESPONSE.Redirect("view.asp?id=" + id)
IF back <> "home" AND UserExists(back) THEN RESPONSE.Redirect("profile.asp?u=" + back)
RESPONSE.Redirect("home.asp")
%>
