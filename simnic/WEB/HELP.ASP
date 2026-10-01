<%@ import file="NIC.SPK" %>
<%
' HELP.ASP - Frequently Asked Questions.
VAR here AS String
viewer = CurrentUser()
here = SERVER.Name.Lower()
%><%= Top("Help") %>
<h2>Frequently Asked Questions</h2>

<h4>What is a domain name?</h4>
<p>Every machine on the SIM95 network has one name, like <tt><%= H(here) %></tt>, and an address
like 65.16.0.7 that changes each time it starts. A domain name, like <tt>coolsite.sim</tt>, is a
name of your own that you can point at any machine, and point somewhere else later.</p>

<h4>How do people find my domain?</h4>
<p>Their computer asks a <b>name server</b>. This machine runs one (SimDNS), and it answers for
every domain registered here. In Simxplorer, choose <b>View, Options</b> and set the name server
to <tt><%= H(here) %></tt>. From the Terminal, <tt>DIG SET <%= H(here) %></tt> does the same for
every program on that machine. Then try <tt>DIG www.coolsite.sim</tt>.</p>

<h4>What records should I make?</h4>
<p>A <b>CNAME</b> to the machine your pages are on: <tt>www CNAME <%= H(here) %></tt>. The name
server follows CNAMEs (to other names in your domain, too) until it reaches a machine name, and
the machine is then found the ordinary SIM95 way. An <b>A</b> record holds an address, which
goes stale as soon as that machine restarts: use one only if you know why. <b>MX</b> says which
machine takes your mail; <b>TXT</b> is any line of text.</p>

<h4>What does Host it here do?</h4>
<p>It makes a folder for your pages on <%= H(here) %> (in <tt>C:\WEB\SITES</tt>), tells the web
server to serve it for your domain and its www, and points both at <%= H(here) %>. Simxplorer
users with this name server type <tt>http://www.coolsite.sim/</tt>. Voyager doesn't know name
servers, so it goes by path: <tt>http://<%= H(here) %>/www.coolsite.sim/</tt>. Use relative
links in your pages and both work.</p>

<h4>Can my name point at another machine's name server?</h4>
<p>Yes. Add a record <tt>east NS bravo</tt> and questions about <tt>east.coolsite.sim</tt> (and
anything under it) go to the SimDNS on BRAVO.</p>
<%= Bottom() %>
