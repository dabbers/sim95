<%@ import file="NIC.SPK" %>
<%
' HELP.ASP - Frequently Asked Questions.
VAR here AS String
viewer = CurrentUser()
here = SERVER.Name.Lower()
%><%= Top("Help") %>
<h2>Frequently Asked Questions</h2>

<h4>What is a domain name?</h4>
<p>Every machine on the SIM95 network has one name, like <tt>alpha</tt>, and an address
like 65.16.0.7 that changes each time it starts. A domain name, like <tt>coolsite.sim</tt>, is a
name of your own that you can point at any machine, and point somewhere else later.</p>

<h4>How do I get my site on the Web at my own name?</h4>
<p>Two steps, in two places:</p>
<ol>
<li><b>Here at SimNIC:</b> register <tt>coolsite.sim</tt>, then on its page type the name of
the machine your site is on in <i>points to machine</i>, and press Save.</li>
<li><b>On that machine:</b> install <b>simweb</b> from any Vapor store and open
<b>Personal Web Manager</b>. Press <i>Add</i>, type <tt>coolsite.sim</tt>, and say what it
serves: your own pages, one of the machine's web apps (SimBook at <tt>coolbook.sim</tt>!) or
its home page.</li>
</ol>
<p>The first tells the network where <tt>coolsite.sim</tt> is; the second tells that machine's
web server which pages it gets. You need both.</p>

<h4>How do people find my domain?</h4>
<p>Every Simxplorer asks the central name server, here on <tt><%= H(here) %></tt>, so a name
registered at SimNIC works everywhere within a few seconds. From the Terminal,
<tt>DIG www.coolsite.sim</tt> shows what the name server says. Voyager doesn't know names: it
reaches the same site by its machine, as <tt>http://alpha/coolsite.sim/</tt>.</p>

<h4>What is Advanced DNS for?</h4>
<p>Most people never need it. A <b>CNAME</b> makes another name under your domain,
like <tt>book.coolsite.sim</tt>, and points it at a machine. An <b>MX</b> record says which
machine takes mail for <tt>you@coolsite.sim</tt> (it needs ColdMail). <b>TXT</b> is any line of
text. An <b>A</b> record holds an address, which goes stale as soon as that machine restarts:
use one only if you know why.</p>

<h4>Can I host my site here?</h4>
<p>No. SimNIC only keeps names. Your pages live on your own machine (or a friend's), and your
domain points there.</p>
<%= Bottom() %>
