<%@ import file="NIC.SPK" %>
<%
' RECORD.ASP - adds a record to one of your domains, or deletes one (POST:
' d, op=add with name, type, value; or op=del with n). The zone file is
' written again, and the name server picks it up in a few seconds.
VAR d AS String
VAR problem AS String
RequireLogin()
RequireToken()
IF REQUEST.Method <> "POST" THEN RESPONSE.Redirect("home.asp")
d = CleanDomain(REQUEST.Form("d"))
IF NOT Owns(viewer, d) THEN RESPONSE.Redirect("home.asp?why=" + UrlEnc("That is not one of your domains."))
IF REQUEST.Form("op") = "del" THEN
    DeleteRecord(d, Int(Val(REQUEST.Form("n"))))
    RESPONSE.Redirect("domain.asp?d=" + UrlEnc(d) + "&ok=1&why=" + UrlEnc("Record deleted."))
END IF
problem = AddRecord(d, REQUEST.Form("name"), REQUEST.Form("type"), REQUEST.Form("value"))
IF problem <> "" THEN RESPONSE.Redirect("domain.asp?d=" + UrlEnc(d) + "&why=" + UrlEnc(problem))
RESPONSE.Redirect("domain.asp?d=" + UrlEnc(d) + "&ok=1&why=" + UrlEnc("Record added. The name server has it within a few seconds."))
%>
