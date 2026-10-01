<%@ import file="NIC.SPK" %>
<%
' REGISTER.ASP - registers a domain (POST d, t). Free, unless this machine
' has SimPal: then the name is held while the buyer pays at SimPal, and
' PAID.ASP finishes the job when they come back with a receipt.
VAR d AS String
VAR problem AS String
VAR order AS String
RequireLogin()
RequireToken()
IF REQUEST.Method <> "POST" THEN RESPONSE.Redirect("home.asp")
d = CleanDomain(REQUEST.Form("d"))
problem = Register(viewer, d)
IF problem <> "" THEN RESPONSE.Redirect("home.asp?why=" + UrlEnc(problem))
order = whyNot
IF order = "" THEN RESPONSE.Redirect("domain.asp?d=" + UrlEnc(d) + "&new=1")
%><%= Top("Pay for " + d) %>
<h2>Almost yours: <%= H(d) %></h2>
<p>SimNIC holds <b><%= H(d) %></b> for you for <%= HOLDMINUTES %> minutes while you pay.
Registration is <b>&sect;<%= NICPRICE %></b> for two years, through SimPal.</p>
<form action="<%= PayUrl() %>" method="post">
<input type="hidden" name="to" value="<%= NICPAL %>">
<input type="hidden" name="amount" value="<%= NICPRICE %>">
<input type="hidden" name="item" value="Domain name <%= H(d) %> (2 years)">
<input type="hidden" name="order" value="<%= order %>">
<input type="hidden" name="return" value="<%= SiteUrl() %>paid.asp">
<table cellpadding="2" bgcolor="#003087"><tr><td><input type="submit" value="Pay with SimPal"></td></tr></table>
</form>
<p><font size="2">Order number <%= order %>. Changed your mind? Just don't pay: the name goes back on the shelf.</font></p>
<%= Bottom() %>
