<%@ import file="PAL.SPK" %>
<%
' MERCHANT.ASP - SimPal for your web site: the Pay with SimPal button to copy
' into your own pages, and the two ways to check a receipt before you ship.
VAR shop AS String
VAR button AS String
viewer = CurrentUser()
shop = viewer
IF shop = "" THEN shop = "yourname"
button = "<form action=""" + SiteUrl() + "pay.asp"" method=""post"">" + Chr(10) _
       + "<input type=""hidden"" name=""to"" value=""" + shop + """>" + Chr(10) _
       + "<input type=""hidden"" name=""amount"" value=""4.99"">" + Chr(10) _
       + "<input type=""hidden"" name=""item"" value=""One widget"">" + Chr(10) _
       + "<input type=""hidden"" name=""order"" value=""ORDER17"">" + Chr(10) _
       + "<input type=""hidden"" name=""return"" value=""http://yourmachine/thanks.asp"">" + Chr(10) _
       + "<input type=""submit"" value=""Pay with SimPal"">" + Chr(10) _
       + "</form>"
%>
<%= Top("SimPal for your web site") %>
<table width="100%" cellpadding="8" cellspacing="0"><tr><td valign="top">
<h2><font color="#003087">SimPal for your web site</font></h2>
<p>Selling something? Put a <b>Pay with SimPal</b> button on your home page and take
SimBucks from anybody on the network, in three easy steps. No merchant account, no
monthly fees, no setup charges. <b>It's FREE!</b></p>
<%= BoxTop("Step 1: Get a SimPal account for your shop") %>
<p><font size="2"><% IF viewer = "" THEN %><a href="index.asp">Sign up</a> (shops sign up just like anybody else). Your user name is your shop's SimPal name.<% ELSE %>You are signed in as <b><%= viewer %></b>, so the button below pays you.<% END IF %></font></p>
<%= BoxTop("Step 2: Paste the button into your page") %>
<p><font size="2">Change the amount, the item and the address SimPal sends the buyer back to. Give every
sale its own <b>order</b> number (letters, digits and <tt>- _ . # : /</tt>, up to <%= MAXORDER %>): SimPal takes payment for an order once.</font></p>
<form><textarea rows="9" cols="76" readonly><%= H(button) %></textarea></form>
<p><font size="2">A link works too:</font><br><tt><font size="2"><%= H(SiteUrl()) %>pay.asp?to=<%= shop %>&amp;amount=4.99&amp;item=One+widget&amp;order=ORDER17&amp;return=http://yourmachine/thanks.asp</font></tt></p>
<p><font size="2">It looks like this: <%= button.Replace("action=""" + SiteUrl() + "pay.asp""", "action=""pay.asp""") %></font></p>
<%= BoxTop("Step 3: Check the receipt, then ship") %>
<p><font size="2">After paying, the buyer comes back to your address with
<tt>?receipt=R12-1A2B3C4D&amp;order=ORDER17</tt> on the end. <b>Anybody can type that in.</b> So before you
hand anything over, ask SimPal whether the receipt is real, paid <i>you</i> the right amount for
<i>that</i> order, and hasn't been used before. A receipt says yes once only.</font></p>
<p><font size="2"><b>(a) Your page is on this machine (<%= H(SERVER.Name.Lower()) %>).</b> Import
<tt>C:\PROGRAMS\PALCHECK.SPK</tt> and call <tt>VerifyReceipt(receipt, merchant, amount, order)</tt>. It reads
SimPal's books straight off the disk. A whole return page:</font></p>
<form><textarea rows="12" cols="76" readonly><%= H(ReadOr(AppDir() + "\THANKS.TXT", "").Replace("%MERCHANT%", shop)) %></textarea></form>
<p><font size="2">SimPal's own <a href="simmart.asp">SimMart</a> works exactly this way.</font></p>
<p><font size="2"><b>(b) Your shop is on another machine.</b> A web page there can't open a connection,
but a SPARK program can (Vapor does). Fetch <tt><%= H(SiteUrl()) %>verify.asp?r=RECEIPT</tt>, adding
<tt>&amp;m=merchant&amp;a=amount&amp;o=order</tt> to have SimPal check those too. The answer is one line of plain text:</font></p>
<table cellpadding="3" border="1"><tr><td><tt>VALID|merchant|amount|order|buyer|date</tt></td><td><font size="2">Paid. Now used up: ship it.</font></td></tr>
<tr><td><tt>USED|merchant|amount|order|buyer|date</tt></td><td><font size="2">Somebody checked this receipt before. Don't ship twice.</font></td></tr>
<tr><td><tt>INVALID|why</tt></td><td><font size="2">No such receipt, or it doesn't match what you asked.</font></td></tr>
<tr><td><tt>BUSY|try again</tt></td><td><font size="2">SimPal was busy. Ask again.</font></td></tr></table>
<p><font size="2">This program does it. Save it as <tt>C:\MYFILES\CHECKPAY.SPK</tt> and run it with the receipt:</font></p>
<form><textarea rows="12" cols="76" readonly><%= H(ReadOr(AppDir() + "\CHECKPAY.TXT", "").Replace("%HOST%", SERVER.Name.Lower()).Replace("%BASE%", SiteUrl().Substring(7 + SERVER.Name.Length, SiteUrl().Length - 7 - SERVER.Name.Length))) %></textarea></form>
<%= BoxTop("Read this first: how much to trust SimPal") %>
<ul><font size="2">
<li><b>It's play money.</b> SimBucks are worth nothing outside SIM95, and SimPal is a toy. Please don't build a real bank like this.</li>
<li><b>Whoever runs <%= H(SERVER.Name.Lower()) %> is the bank.</b> They can print SimBucks (the welcome bonus and grants) and read or change anything in <tt>C:\PALDATA</tt>. You are trusting them.</li>
<li><b>The button is just HTML.</b> A buyer can save your page and change the price. That's why you check the amount when you verify.</li>
<li><b>Coming back proves nothing.</b> Only a VALID answer does.</li>
<li><b>Nothing is encrypted.</b> SIM95 has no SSL; anybody running Monitor can read passwords and receipts as they go by. The padlock is decoration.</li>
<li><b>A receipt is a password for one order.</b> The buyer knows it too and could use it up by checking it first. They'd only be hurting themselves.</li>
<li><b>Refunds:</b> send the money back by hand, with Send Money.</li>
</font></ul>
</td><td width="200" valign="top"><%= Padlock() %></td></tr></table>
<%= Bottom() %>
