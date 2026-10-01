<%@ import file="BOOK.SPK" %>
<%
' FRIEND.ASP - add or remove a friend. Friendship goes both ways at once.
VAR who AS String
RequireLogin()
RequireToken()
IF REQUEST.Method <> "POST" THEN RESPONSE.Redirect("home.asp")
who = CleanName(REQUEST.Form("u"))
IF NOT UserExists(who) THEN RESPONSE.Redirect("people.asp")
IF REQUEST.Form("do") = "remove" THEN
    RemoveFriend(viewer, who)
ELSE
    AddFriend(viewer, who)
END IF
RESPONSE.Redirect("profile.asp?u=" + who)
%>
