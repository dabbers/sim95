<%@ import file="TRACK.SPK" %>
<%@ import file="STATS.SPK" %>
<%
' LOGOUT.ASP?t=token - forgets the session on disk and in the browser. The
' token stops another site from logging you out.
RequireLogin()
RequireToken()
SignOut()
RESPONSE.Redirect("index.asp?e=bye")
%>
