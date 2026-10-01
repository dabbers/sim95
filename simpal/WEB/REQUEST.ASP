<%@ import file="PAL.SPK" %>
<%
' REQUEST.ASP - ask another member for money. They see it on their account
' page and can pay or decline it; you can cancel it until then. Those buttons
' post here too (do=pay, decline or cancel, id=the request).
VAR problem AS String
VAR act AS String
RequireLogin()
IF REQUEST.Method = "POST" THEN
    RequireToken()
    act = REQUEST.Form("do")
    IF act = "pay" THEN
        problem = PayRequest(viewer, REQUEST.Form("id"))
        IF problem = "" THEN RESPONSE.Redirect("home.asp?why=" + UrlEnc("Paid! The request is settled."))
        RESPONSE.Redirect("home.asp?why=" + UrlEnc(problem))
    ELSEIF act = "decline" OR act = "cancel" THEN
        problem = DropRequest(viewer, REQUEST.Form("id"))
        IF problem = "" AND act = "decline" THEN problem = "Request declined. No money moved."
        IF problem = "" THEN problem = "Request cancelled."
        RESPONSE.Redirect("home.asp?why=" + UrlEnc(problem))
    ELSE
        problem = AskMoney(viewer, REQUEST.Form("from"), REQUEST.Form("amount"), REQUEST.Form("note"))
        IF problem = "" THEN RESPONSE.Redirect("home.asp?why=" + UrlEnc("Your request is on its way to " + REQUEST.Form("from").Trim().Lower() + "."))
    END IF
END IF
%>
<%= Top("Request Money") %>
<table width="100%" cellpadding="8" cellspacing="0"><tr><td valign="top">
<%= Notice(problem) %>
<%= BoxTop("Request Money") %>
<p><font size="2">Somebody owes you? Send them a request. It waits on their account page until they pay it or decline it.</font></p>
<form action="request.asp" method="post"><%= TokenField() %>
<table cellpadding="4">
<tr><td><font size="2">From (user name):</font></td><td><input name="from" size="16" value="<%= H(REQUEST.Form("from")) %>"></td></tr>
<tr><td><font size="2">Amount:</font></td><td><font size="2">&sect;</font> <input name="amount" size="10" value="<%= H(REQUEST.Form("amount")) %>"></td></tr>
<tr><td><font size="2">What for:</font></td><td><input name="note" size="40" maxlength="<%= MAXNOTE %>" value="<%= H(REQUEST.Form("note")) %>"></td></tr>
<tr><td></td><td><input type="submit" value="Send Request"></td></tr>
</table>
</form>
</td></tr></table>
<%= Bottom() %>
