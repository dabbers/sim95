<%@ import file="PAL.SPK" %>
<%
' PAY.ASP - "Pay with SimPal": the checkout another web site sends its buyers
' to, by form (GET or POST) or by link, with
'   to=the shop's SimPal user name   amount=4.99   item=what it is
'   order=the shop's order number    return=http://... (where to come back to)
' The buyer logs in, checks the details and presses Pay. The money moves, and
' the buyer goes back to return with ?receipt=R12-1A2B3C4D&order=... added.
' The shop then checks that receipt (verify.asp, or PALCHECK.SPK on this
' machine) before it hands anything over.
VAR merchant AS String
VAR amount AS String
VAR item AS String
VAR order AS String
VAR back AS String
VAR problem AS String
VAR args AS String
VAR sep AS String
VAR paid AS Bool
merchant = Arg("to").Trim().Lower()
amount = Arg("amount").Trim()
item = Clip(Arg("item"), MAXITEM)
order = Arg("order").Trim()
back = Arg("return").Trim()
viewer = CurrentUser()
problem = CheckoutProblem(merchant, amount, order, back)
args = "to=" + UrlEnc(merchant) + "&amount=" + UrlEnc(amount) + "&item=" + UrlEnc(item) + "&order=" + UrlEnc(order) + "&return=" + UrlEnc(back)
sep = "?"
IF back.Contains("?") THEN sep = "&"
IF problem = "" AND viewer <> "" AND REQUEST.Form("do") = "pay" THEN
    RequireToken()
    problem = PayMerchant(viewer, merchant, amount, item, order)
    IF problem = "" AND back <> "" THEN RESPONSE.Redirect(back + sep + "receipt=" + lastRef + "&order=" + UrlEnc(order))
    IF problem = "" THEN paid = TRUE
END IF
IF problem = "" AND viewer = "" AND REQUEST.Query("e") = "login" THEN problem = "That user name and password do not match."
%>
<script runat="server">
' A field from the shop's form (POST) or link (GET).
FUNCTION Arg (name AS String) AS String
    IF REQUEST.Form(name) <> "" THEN RETURN REQUEST.Form(name)
    RETURN REQUEST.Query(name)
END FUNCTION

FUNCTION Hidden (name AS String, value AS String) AS String
    RETURN "<input type=""hidden"" name=""" + name + """ value=""" + H(value) + """>"
END FUNCTION
</script>
<%= Top("Pay with SimPal") %>
<table width="100%" cellpadding="8" cellspacing="0"><tr><td valign="top">
<%= BoxTop("Pay with SimPal") %>
<% IF CheckoutProblem(merchant, amount, order, back) = "" THEN %>
<table cellpadding="4" cellspacing="0" border="1" width="100%">
<tr><td bgcolor="#E6F0FA" width="120"><font size="2"><b>Pay to</b></font></td><td><font size="2"><b><%= H(NameOf(merchant)) %></b> (<%= merchant %>)</font></td></tr>
<tr><td bgcolor="#E6F0FA"><font size="2"><b>For</b></font></td><td><font size="2"><%= H(item) %><% IF item = "" THEN %>(no description)<% END IF %></font></td></tr>
<tr><td bgcolor="#E6F0FA"><font size="2"><b>Order number</b></font></td><td><font size="2"><tt><%= H(order) %></tt></font></td></tr>
<tr><td bgcolor="#E6F0FA"><font size="2"><b>Amount</b></font></td><td><font size="4" color="#003087"><b><%= Bucks(ParseCents(amount)) %></b></font></td></tr>
</table>
<% END IF %>
<%= Notice(problem) %>
<% IF paid THEN %>
<p><font size="3"><b>Payment complete. Thank you!</b></font></p>
<p><font size="2">Your receipt number is <b><tt><%= lastRef %></tt></b>. Give it to <%= H(NameOf(merchant)) %> if they ask for it.
<a href="home.asp">Back to My Account</a></font></p>
<% ELSEIF CheckoutProblem(merchant, amount, order, back) <> "" THEN %>
<p><font size="2">Nothing has been paid. <% IF ValidReturn(back) AND back <> "" THEN %><a href="<%= H(back) %>">Go back to the shop</a><% END IF %></font></p>
<% ELSEIF viewer = "" THEN %>
<p><font size="2"><b>Log in to SimPal to pay.</b> We never tell the shop your password.</font></p>
<form action="login.asp" method="post">
<%= Hidden("next", "pay.asp?" + args) %>
<table cellpadding="3">
<tr><td><font size="2">User name:</font></td><td><input name="u" size="16"></td></tr>
<tr><td><font size="2">Password:</font></td><td><input type="password" name="pw" size="16"></td></tr>
<tr><td></td><td><input type="submit" value="Log In"></td></tr>
</table>
</form>
<p><font size="2">New to SimPal? <a href="index.asp?next=<%= UrlEnc("pay.asp?" + args) %>">Sign up</a>. It's free, and you get <%= Bucks(BONUS) %> to spend!</font></p>
<% ELSE %>
<p><font size="2">You are logged in as <b><%= H(NameOf(viewer)) %></b> (<%= viewer %>). Your balance is <b><%= Bucks(Balance(viewer)) %></b>.</font></p>
<form action="pay.asp" method="post"><%= TokenField() %>
<%= Hidden("do", "pay") %><%= Hidden("to", merchant) %><%= Hidden("amount", amount) %><%= Hidden("item", item) %><%= Hidden("order", order) %><%= Hidden("return", back) %>
<p><input type="submit" value="Pay <%= Bucks(ParseCents(amount)) %> Now"></p>
</form>
<p><font size="2"><% IF back <> "" THEN %><a href="<%= H(back + sep + "cancelled=1&order=" + UrlEnc(order)) %>">Cancel and go back to the shop</a><% ELSE %><a href="home.asp">Cancel</a><% END IF %></font></p>
<% END IF %>
</td><td width="200" valign="top"><%= Padlock() %>
<p><font size="1" color="#808080">SimPal pays the shop straight from your SimPal balance. The shop never sees your password.</font></p></td></tr></table>
<%= Bottom() %>
