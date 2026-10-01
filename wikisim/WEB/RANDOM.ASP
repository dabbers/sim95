<%@ import file="WIKI.SPK" %>
<%
' RANDOM.ASP - off to any article at all.
VAR id AS Integer
id = RandomArticle()
IF id = 0 THEN RESPONSE.Redirect("index.asp")
RESPONSE.Redirect("article.asp?a=" + Str(id))
%>
