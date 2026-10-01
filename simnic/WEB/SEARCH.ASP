<%@ import file="NIC.SPK" %>
<%
' SEARCH.ASP?d=coolsite - is a name free? A name without its .sim/.com/...
' is looked up under all four.
VAR asked AS String
VAR names AS Array OF String
VAR tld AS String
VAR d AS String
VAR rows AS String
VAR rec AS Array OF String
viewer = CurrentUser()
asked = REQUEST.Query("d").Trim().Lower()
IF asked.StartsWith("www.") THEN asked = asked.Substring(4, asked.Length - 4)
IF asked <> "" AND NOT asked.Contains(".") THEN
    FOR EACH tld IN ["sim", "com", "net", "org"]
        names.Add(asked + "." + tld)
    NEXT
ELSEIF asked <> "" THEN
    names.Add(asked)
END IF
FOR EACH d IN names
    IF CleanDomain(d) = "" THEN
        rows = rows + "<tr><td><b>" + H(d) + "</b></td><td colspan=""2"">is not a name SimNIC can register: 2 to 24 letters, digits or hyphens, then .sim, .com, .net or .org.</td></tr>"
        CONTINUE
    END IF
    d = CleanDomain(d)
    IF IsFree(d) THEN
        rows = rows + "<tr><td><b>" + H(d) + "</b></td><td><font color=""#008000""><b>Available!</b></font></td><td>"
        IF viewer <> "" THEN
            rows = rows + "<form action=""register.asp"" method=""post"">" + TokenField() + "<input type=""hidden"" name=""d"" value=""" + H(d) + """><input type=""submit"" value=""Register " + H(d) + """></form>"
        ELSE
            rows = rows + "<font size=""2""><a href=""index.asp"">Log in or sign up</a> to register it.</font>"
        END IF
        rows = rows + "</td></tr>"
    ELSE
        rec = DomainRec(d)
        rows = rows + "<tr><td><b>" + H(d) + "</b></td><td><font color=""#CC0000"">Taken</font></td><td><font size=""2""><a href=""whois.asp?d=" + UrlEnc(d) + """>Who has it?</a></font></td></tr>"
    END IF
NEXT
%><%= Top("Search") %>
<h2>Domain Name Search</h2>
<form action="search.asp" method="get">www.<input name="d" size="24" value="<%= H(asked) %>"> <input type="submit" value="Search"></form>
<% IF rows <> "" THEN %>
<table cellpadding="6" border="1" cellspacing="0"><%= rows %></table>
<% END IF %>
<%= Bottom() %>
