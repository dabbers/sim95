<%@ import file="NIC.SPK" %>
<%
' POINT.ASP - points one of your domains at a machine (POST d, machine, t):
' CNAMEs for the domain itself and its www. An empty machine takes them away.
VAR d AS String
VAR problem AS String
VAR m AS String
RequireLogin()
RequireToken()
IF REQUEST.Method <> "POST" THEN RESPONSE.Redirect("home.asp")
d = CleanDomain(REQUEST.Form("d"))
IF NOT Owns(viewer, d) THEN RESPONSE.Redirect("home.asp?why=" + UrlEnc("That is not one of your domains."))
problem = PointAt(viewer, d, REQUEST.Form("machine"))
IF problem <> "" THEN RESPONSE.Redirect("domain.asp?d=" + UrlEnc(d) + "&why=" + UrlEnc(problem))
m = PointsTo(d)
IF m = "" THEN RESPONSE.Redirect("domain.asp?d=" + UrlEnc(d) + "&ok=1&why=" + UrlEnc(d + " points nowhere now."))
RESPONSE.Redirect("domain.asp?d=" + UrlEnc(d) + "&ok=1&why=" + UrlEnc(d + " and www." + d + " point to " + m + " now. The name server has it within a few seconds."))
%>
