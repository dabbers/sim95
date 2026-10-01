<%@ import file="PAL.SPK" %>
<%
' HISTORY.ASP - your transactions, newest first.
RequireLogin()
%>
<%= Top("History") %>
<table width="100%" cellpadding="8" cellspacing="0"><tr><td valign="top">
<%= BoxTop("Transaction History") %>
<p><font size="2">Balance: <b><%= Bucks(Balance(viewer)) %></b> &middot; <%= TxCount(viewer) %> transaction(s)<% IF TxCount(viewer) > HISTSHOW THEN %>, the newest <%= HISTSHOW %> shown<% END IF %>.</font></p>
<table width="100%" cellpadding="3" cellspacing="1">
<tr bgcolor="#E6F0FA"><td><font size="2"><b>Date</b></font></td><td><font size="2"><b>Description</b></font></td><td align="right"><font size="2"><b>Amount</b></font></td><td><font size="2"><b>No.</b></font></td></tr>
<%= HistoryHtml(viewer, HISTSHOW) %>
</table>
</td></tr></table>
<%= Bottom() %>
