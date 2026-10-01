<%@ import file="BOOK.SPK" %>
<%
' LOGOUT.ASP - forgets the session on disk and in Voyager.
SignOut()
RESPONSE.Redirect("index.asp?e=bye")
%>
