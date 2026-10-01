<%@ import file="NIC.SPK" %>
<%
' INDEX.ASP - SimNIC's front page: look a name up, log in or sign up.
VAR taken AS Integer
VAR why AS String
VAR cost AS String
viewer = CurrentUser()
taken = CountDomains()
why = REQUEST.Query("why")
IF REQUEST.Query("e") = "login" THEN why = "That user name and password don't match."
IF REQUEST.Query("e") = "bye" THEN why = "You are logged out. Thank you for using SimNIC."
cost = "<b>FREE</b> while the SIM95 network is young"
IF PayOn() THEN cost = "<b>&sect;" + NICPRICE + "</b> for two years, paid with SimPal"
%><%= Top("Domain Name Registration") %>
<%= Notice(why, FALSE) %>
<table width="100%" cellpadding="8"><tr><td valign="top">
<h2>Register your own domain name!</h2>
<p>Why be <tt>http://<%= H(SERVER.Name.Lower()) %>/~you/</tt> when you can be
<b>www.<i>yourname</i>.sim</b>? A domain name is yours to keep, wherever your
pages live: point it at any machine on the network, and change it any time.</p>
<form action="search.asp" method="get">
<table bgcolor="#000066" cellpadding="6"><tr><td><font color="#FFFFFF"><b>Is your name taken?</b></font><br>
<font color="#FFFFFF">www.</font><input name="d" size="24"> <input type="submit" value="Search"></td></tr></table>
</form>
<p><font size="2">.sim, .com, .net and .org. Registration is <%= cost %>.</font></p>
<h3>What's New</h3>
<ul>
<li><b>One box, and you're on the Web.</b> Register a name, type the name of the machine your site is on,
press Save. That's it.</li>
<li><b>Point names at machines.</b> SIM95 addresses change every time a machine starts, but its name doesn't:
SimNIC points your domain at your machine's name, so it always finds you.</li>
<li><%= taken %> domain<% IF taken <> 1 THEN %>s<% END IF %> registered so far. Don't wait - the good ones are going fast!</li>
</ul>
<p><font size="2">Every Simxplorer on the network asks <b><%= H(SERVER.Name.Lower()) %></b> about names like these,
so a name registered here works everywhere at once. Voyager doesn't know names, but it can visit any site
by its machine: <tt>http://<i>machine</i>/www.<i>yourname</i>.sim/</tt>. <a href="help.asp">More help</a>.</font></p>
</td><td valign="top" width="230" bgcolor="#EEEEFF">
<% IF viewer <> "" THEN %>
<p>Welcome back, <b><%= H(NameOf(viewer)) %></b>.</p>
<p><a href="home.asp">My Domains</a></p>
<% ELSE %>
<form action="login.asp" method="post">
<b>Existing contacts</b><br>
<font size="2">User name</font><br><input name="u" size="14"><br>
<font size="2">Password</font><br><input type="password" name="pw" size="14"><br>
<input type="submit" value="Log In">
</form>
<hr>
<form action="join.asp" method="post">
<b>New contact? Sign up</b><br>
<font size="2">Your name or company</font><br><input name="name" size="18"><br>
<font size="2">User name (3-8 letters)</font><br><input name="u" size="14"><br>
<font size="2">Password</font><br><input type="password" name="pw" size="14"><br>
<font size="2">Password again</font><br><input type="password" name="pw2" size="14"><br>
<input type="submit" value="Sign Up">
</form>
<% END IF %>
</td></tr></table>
<%= Bottom() %>
