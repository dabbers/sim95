<%@ import file="NIC.SPK" %>
<%
' HOSTIT.ASP - Host it here (POST d): a folder in C:\WEB\SITES, a line in
' C:\WEB\VHOSTS.TXT for the domain and its www, and CNAMEs to this machine.
VAR d AS String
VAR problem AS String
RequireLogin()
RequireToken()
IF REQUEST.Method <> "POST" THEN RESPONSE.Redirect("home.asp")
d = CleanDomain(REQUEST.Form("d"))
IF NOT Owns(viewer, d) THEN RESPONSE.Redirect("home.asp?why=" + UrlEnc("That is not one of your domains."))
problem = HostHere(d)
IF problem <> "" THEN RESPONSE.Redirect("domain.asp?d=" + UrlEnc(d) + "&why=" + UrlEnc(problem))
RESPONSE.Redirect("domain.asp?d=" + UrlEnc(d) + "&ok=1&why=" + UrlEnc(d + " is hosted here. Put your pages in " + SiteFolder(d) + "."))
%>
