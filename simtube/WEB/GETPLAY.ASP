<%@ import file="TUBE.SPK" %>
<%
' GETPLAY.ASP - where to get SimPlayer: it is built into Simxplorer, and on
' its own it is a program in Vapor (every Vapor store stocks it).
VAR store AS String
viewer = CurrentUser()
IF FS.Exists("C:\WEB\VAPOR\CATALOG.TXT") THEN
    IF FS.Read("C:\WEB\VAPOR\CATALOG.TXT").Contains("SIMPLAYR|") THEN store = "http://" + SERVER.Name.Lower() + "/vapor/"
END IF
%>
<%= Top("Get SimPlayer") %>
<table width="100%" cellpadding="8" cellspacing="0"><tr><td valign="top">
<%= BoxTop("Get SimPlayer") %>
<p><b>Using Simxplorer?</b> You already have it. SimPlayer is built in: click a movie's
<b>Play</b> link and it pops up.</p>
<p><b>Using Voyager?</b> Get <b>SimPlayer</b> from <b>Vapor</b>. It's free, in the Apps section
of the store, and Vapor keeps it up to date.</p>
<ul>
<% IF store <> "" THEN %>
<li>This machine is a Vapor store: <a href="<%= store %>"><%= store %></a>. Get Vapor there if you
haven't, then install SimPlayer from its Store tab (or type <tt>sim-get install simplayr</tt> in the Sim Shell).</li>
<% ELSE %>
<li>Open Vapor's Store tab and install SimPlayer, or type <tt>sim-get install simplayr</tt> in the Sim Shell.
No Vapor yet? Any Vapor store's page (<tt>http://<i>store</i>/vapor/</tt>) hands it out.</li>
<% END IF %>
</ul>
<p><a href="index.asp">Back to SimTube</a></p>
</td></tr></table>
<%= Bottom() %>
