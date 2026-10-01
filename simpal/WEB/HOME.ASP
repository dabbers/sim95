<%@ import file="PAL.SPK" %>
<%
' HOME.ASP - My Account: the balance, money requests both ways, and the
' newest transactions.
VAR incoming AS String
VAR outgoing AS String
RequireLogin()
incoming = RequestsHtml(viewer, TRUE)
outgoing = RequestsHtml(viewer, FALSE)
%>
<%= Top("My Account") %>
<table width="100%" cellpadding="8" cellspacing="0"><tr>
<td width="170" valign="top" bgcolor="#E6F0FA">
<font size="2"><b><%= H(NameOf(viewer)) %></b><br><font color="#808080"><%= viewer %></font></font>
<p><font size="2">
<a href="send.asp"><b>Send Money</b></a><br>
<a href="request.asp"><b>Request Money</b></a><br>
<a href="history.asp">History</a><br>
<a href="simmart.asp">Shop at SimMart</a><br>
<a href="merchant.asp">Accept SimPal on your site</a></font></p>
<%= Padlock() %>
</td>
<td valign="top">
<% IF REQUEST.Query("new") = "1" THEN %>
<%= Notice("Welcome to SimPal! We have put " + Bucks(BONUS).Replace("&sect;", "§") + " in your account to get you started.") %>
<% END IF %>
<%= Notice(REQUEST.Query("why")) %>
<%= BoxTop("My Balance") %>
<p><font size="6" color="#003087"><b><%= Bucks(Balance(viewer)) %></b></font>
<font size="2" color="#808080">&nbsp;available SimBucks</font></p>
<% IF incoming <> "" THEN %>
<%= BoxTop("Money Requests for You") %>
<table width="100%" cellpadding="3"><%= incoming %></table>
<% END IF %>
<% IF outgoing <> "" THEN %>
<%= BoxTop("Your Requests Waiting") %>
<table width="100%" cellpadding="3"><%= outgoing %></table>
<% END IF %>
<%= BoxTop("Recent Activity") %>
<table width="100%" cellpadding="3" cellspacing="1"><%= HistoryHtml(viewer, HOMESHOW) %></table>
<p><font size="2"><a href="history.asp">See all my transactions</a></font></p>
</td>
</tr></table>
<%= Bottom() %>
