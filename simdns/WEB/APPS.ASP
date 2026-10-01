<%@ import file="NIC.SPK" %>
<%
' APPS.ASP - on a SimHost machine (POST d): book.coolsite.sim for SimBook in
' C:\WEB\BOOK, mail.coolsite.sim for ColdMail, and so on - a CNAME to this
' machine and a line in VHOSTS.TXT each, so every app is a site of its own.
VAR d AS String
VAR n AS Integer
RequireLogin()
RequireToken()
IF REQUEST.Method <> "POST" THEN RESPONSE.Redirect("home.asp")
d = CleanDomain(REQUEST.Form("d"))
IF NOT Owns(viewer, d) THEN RESPONSE.Redirect("home.asp?why=" + UrlEnc("That is not one of your domains."))
n = PointApps(d)
RESPONSE.Redirect("domain.asp?d=" + UrlEnc(d) + "&ok=1&why=" + UrlEnc(Str(n) + " apps have names in " + d + " now."))
%>
