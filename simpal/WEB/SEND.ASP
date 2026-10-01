<%@ import file="PAL.SPK" %>
<%
' SEND.ASP - send money to another member, with a note. The form posts back
' here; the money moves and you land on your account.
VAR problem AS String
VAR p AS Array OF String
VAR who AS String
VAR whoList AS String
RequireLogin()
IF REQUEST.Method = "POST" THEN
    RequireToken()
    problem = SendMoney(viewer, REQUEST.Form("to"), REQUEST.Form("amount"), REQUEST.Form("note"))
    IF problem = "" THEN RESPONSE.Redirect("home.asp?why=" + UrlEnc("Sent! " + Bucks(ParseCents(REQUEST.Form("amount"))).Replace("&sect;", "§") + " is on its way to " + REQUEST.Form("to").Trim().Lower() + "."))
END IF
FOR EACH who IN People()
    p = who.Split("|")
    IF p[0] <> viewer AND whoList.Length < 3000 THEN whoList = whoList + "<a href=""send.asp?to=" + p[0] + """>" + p[0] + "</a> "
NEXT
%>
<%= Top("Send Money") %>
<table width="100%" cellpadding="8" cellspacing="0"><tr><td valign="top">
<%= Notice(problem) %>
<%= BoxTop("Send Money") %>
<form action="send.asp" method="post"><%= TokenField() %>
<table cellpadding="4">
<tr><td><font size="2">To (user name):</font></td><td><input name="to" size="16" value="<%= H(REQUEST.Form("to") + REQUEST.Query("to")) %>"></td></tr>
<tr><td><font size="2">Amount:</font></td><td><font size="2">&sect;</font> <input name="amount" size="10" value="<%= H(REQUEST.Form("amount")) %>"> <font size="1" color="#808080">like 5 or 12.50</font></td></tr>
<tr><td><font size="2">Note:</font></td><td><input name="note" size="40" maxlength="<%= MAXNOTE %>" value="<%= H(REQUEST.Form("note")) %>"></td></tr>
<tr><td></td><td><input type="submit" value="Send Money Now"></td></tr>
</table>
</form>
<p><font size="2">You have <b><%= Bucks(Balance(viewer)) %></b>.</font></p>
<% IF whoList <> "" THEN %><p><font size="2">Members: <%= whoList %></font></p><% END IF %>
</td><td width="200" valign="top"><%= Padlock() %></td></tr></table>
<%= Bottom() %>
