<%@ import file="TUBE.SPK" %>
<%
' RATE.ASP - one to five stars for a movie (once each; again changes it), then back to it.
VAR line AS String
VAR given AS Integer
RequireLogin()
RequireToken()
IF REQUEST.Method <> "POST" THEN RESPONSE.Redirect("index.asp")
line = FindVideo(REQUEST.Form("v"))
IF line = "" THEN RESPONSE.Redirect("index.asp")
given = Int(Val(REQUEST.Form("stars")))
IF given < 1 OR given > 5 THEN RESPONSE.Redirect("watch.asp?back=1&v=" + VF(line, 0) + "&why=" + UrlEnc("Pick from one to five stars."))
Rate(VF(line, 0), viewer, given)
RESPONSE.Redirect("watch.asp?back=1&v=" + VF(line, 0) + "&why=" + UrlEnc("Thanks! You gave it " + Plural(given, "star", "stars") + "."))
%>
