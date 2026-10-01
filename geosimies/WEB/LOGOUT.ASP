<%@ import file="GEO.SPK" %>
<%
' LOGOUT.ASP?t=token - forgets the session. The token stops another site from
' logging you out.
RequireLogin()
RequireToken()
SignOut()
RESPONSE.Redirect("index.asp?e=bye")
%>
