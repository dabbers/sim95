<%@ import file="MAIL.SPK" %>
<%
' LOGOUT.ASP?t=token - forgets the session. The token stops other sites signing you out.
RequireLogin()
RequireToken()
SignOut()
RESPONSE.Redirect("index.asp?e=bye")
%>
