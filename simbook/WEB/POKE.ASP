<%@ import file="BOOK.SPK" %>
<%
' POKE.ASP?u=name&do=poke|clear&b=home|profile - poke a friend (which also
' clears their poke at you), or brush their poke off. Carries the form token.
VAR who AS String
VAR problem AS String
VAR back AS String
RequireLogin()
RequireToken()
who = CleanName(REQUEST.Query("u"))
IF REQUEST.Query("do") = "clear" THEN
    ClearPoke(viewer, who)
ELSE
    problem = Poke(viewer, who)
    IF problem = "" THEN problem = "You poked " + NameOf(who) + "."
END IF
IF REQUEST.Query("b") = "profile" AND UserExists(who) THEN
    back = "profile.asp?u=" + who + "&why="
ELSE
    back = "home.asp?why="
END IF
RESPONSE.Redirect(back + UrlEnc(problem))
%>
