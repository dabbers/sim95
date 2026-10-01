<%@ import file="C:\PROGRAMS\PALCHECK.SPK" %>
<%
' SIMMART.ASP - SimMart, a pretend shop that takes SimPal: the example for
' anyone who wants a Pay with SimPal button on their own pages. It is an
' ordinary shop page, as one on any machine would be. It doesn't use PAL.SPK,
' only C:\PROGRAMS\PALCHECK.SPK, which any page on this machine can import.
'   1. The page makes up an order number and shows the button: a form that
'      goes to SimPal's pay.asp with the price, the order and where to come back.
'   2. SimPal sends the buyer back here with ?receipt=...&order=...
'   3. VerifyReceipt says whether that receipt really paid SimMart the price for
'      that order, and uses it up, so coming back twice ships nothing twice.
CONST MART = "simmart"
CONST PRICE = "4.99"
CONST WARE = "Genuine Y2K Bug (in a jar)"
VAR order AS String
VAR receipt AS String
VAR info AS Array OF String
VAR said AS String
VAR good AS Bool
receipt = REQUEST.Query("receipt").Trim()
IF receipt <> "" THEN
    info = (ReceiptInfo(receipt) + "|||||").Split("|")
    good = VerifyReceipt(receipt, MART, PRICE, REQUEST.Query("order"))
    IF good THEN
        said = "Thank you, " + info[3] + "! Order " + REQUEST.Query("order") + " is paid (SimPal receipt " + receipt + "). Your Y2K bug ships in 6 to 8 weeks."
    ELSEIF PalWhy = "used" THEN
        said = "That receipt has already been used for order " + info[2] + ". One receipt, one bug."
    ELSE
        said = "Sorry, SimPal says that receipt is no good (" + PalWhy + "). Nothing will ship."
    END IF
ELSEIF REQUEST.Query("cancelled") = "1" THEN
    said = "No problem. Maybe next millennium."
END IF
order = "SM" + Str(TIME.Now) + Hex(Rnd(65536))
%><html><head><title>SimMart - Shop Online with Confidence!</title>
<meta name="description" content="SimMart: the online shopping mall for SIM95. Pay with SimPal.">
<meta name="keywords" content="shop, shopping, online shopping, store, mall, buy, y2k, pay with simpal, e-commerce">
</head>
<body bgcolor="#FFFFFF" link="#CC0000" vlink="#CC0000">
<table width="100%" cellpadding="8" cellspacing="0" bgcolor="#CC0000"><tr><td>
<font size="6" color="#FFFFFF"><b>SimMart</b></font> <font color="#FFFF00"><b><i>Shop online with confidence!</i></b></font></td>
<td align="right"><font size="2" color="#FFFFFF">Open 24 hours &middot; Now Y2K compliant</font></td></tr></table>
<% IF said <> "" THEN %>
<table width="100%" cellpadding="6"><tr><td bgcolor="<% IF good THEN %>#E0FFE0<% ELSE %>#FFF9D7<% END IF %>"><font size="3"><b><%= SERVER.HtmlEncode(said) %></b></font></td></tr></table>
<% END IF %>
<table cellpadding="10"><tr>
<td valign="top"><pre><font color="#808080">
   _______
  [_______]
   |     |
   | {*} |
   | /|\ |
   |_____|
</font></pre></td>
<td valign="top">
<h2><%= WARE %></h2>
<p>Caught live in a 1970s COBOL mainframe. Two digits for the year, air holes in the lid.
Set it free on 1 January 2000 and watch the fun!<br><font size="2" color="#808080">Batteries not included. Not a real bug.</font></p>
<p><font size="5" color="#CC0000"><b>&sect;<%= PRICE %></b></font> <font size="2"><s>&sect;19.99</s> SAVE 75%!!</font></p>
<% IF PalMember(MART) THEN %>
<form action="<%= PalPayUrl() %>" method="post">
<input type="hidden" name="to" value="<%= MART %>">
<input type="hidden" name="amount" value="<%= PRICE %>">
<input type="hidden" name="item" value="<%= WARE %>">
<input type="hidden" name="order" value="<%= order %>">
<input type="hidden" name="return" value="<%= PalPayUrl().Replace("pay.asp", "simmart.asp") %>">
<table cellpadding="2" bgcolor="#003087"><tr><td><input type="submit" value="Pay with SimPal"></td><td><font size="1" color="#FFCC00"><b>Secure!</b></font></td></tr></table>
</form>
<font size="1" color="#808080">Your order number: <%= order %></font>
<% ELSE %>
<p><font size="2"><b>SimMart is closed.</b> It takes money through a SimPal account called
<b><%= MART %></b>, and there isn't one yet. Sign up for SimPal as <%= MART %> (this is a demo: anyone may) and the shop opens.</font></p>
<% END IF %>
</td></tr></table>
<hr><center><font size="1" color="#808080">SimMart is a demo shop for <a href="merchant.asp">SimPal for your web site</a>. &copy; 1999 SimMart Inc.</font></center>
</body></html>
