<%@ import file="TRACK.SPK" %>
<%@ import file="STATS.SPK" %>
<%
' ADDSITE.ASP - a new site to count (POST name, url, t). It gets an id of 8
' hex digits, and the next stop is the code to paste into its pages.
VAR problem AS String
RequireLogin()
IF REQUEST.Method <> "POST" THEN RESPONSE.Redirect("index.asp")
RequireToken()
problem = AddSite(viewer, REQUEST.Form("name"), REQUEST.Form("url"))
IF problem <> "" THEN RESPONSE.Redirect("index.asp?e=site&why=" + UrlEnc(problem))
RESPONSE.Redirect("code.asp?s=" + lastSite + "&new=1")
%>
