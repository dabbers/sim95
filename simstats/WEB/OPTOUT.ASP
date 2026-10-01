<%@ import file="TRACK.SPK" %>
<%@ import file="STATS.SPK" %>
<%
' OPTOUT.ASP - a visitor can tell SimStats not to count them. It is a cookie
' on this machine (ssout=1), which the browser sends along with every SimStats
' tag on every site, so hit.asp sees it and counts nothing. It lasts as long
' as the browser keeps the cookie (C:\SYSTEM\COOKIES.TXT).
VAR said AS String
viewer = CurrentUser()
indexable = TRUE
IF REQUEST.Method = "POST" THEN
    IF REQUEST.Form("do") = "out" THEN
        RESPONSE.SetCookie(OUTCOOKIE, "1")
        RESPONSE.SetCookie(VIDCOOKIE, "")
        RESPONSE.Redirect("optout.asp?done=out")
    ELSEIF REQUEST.Form("do") = "in" THEN
        RESPONSE.SetCookie(OUTCOOKIE, "")
        RESPONSE.Redirect("optout.asp?done=in")
    END IF
END IF
IF REQUEST.Query("done") = "out" THEN said = "Done. SimStats will not count you on any site, from now on."
IF REQUEST.Query("done") = "in" THEN said = "Welcome back! SimStats counts your visits again."
%>
<%= Top("Don't Count Me") %>
<table width="100%" cellpadding="8" cellspacing="0"><tr><td valign="top">
<%= Notice(said) %>
<%= BoxTop("Don't Count Me") %>
<p><font size="3">Sites all over the network use SimStats to see how many people visit them.
If you'd rather not be one of the numbers, that's fine with us. Press the button and SimStats
won't count you on <b>any</b> site that uses it.</font></p>
<% IF REQUEST.Cookie(OUTCOOKIE) = "1" THEN %>
<p><font size="3" color="#006600"><b>Right now, SimStats is NOT counting you.</b></font></p>
<form action="optout.asp" method="post"><input type="hidden" name="do" value="in"><input type="submit" value="Count me again"></form>
<% ELSE %>
<p><font size="3" color="#CC0000"><b>Right now, SimStats is counting your visits.</b></font></p>
<form action="optout.asp" method="post"><input type="hidden" name="do" value="out"><input type="submit" value="Don't count me"></form>
<% END IF %>
<p><font size="2"><b>How it works:</b> the button leaves a cookie from <%= H(SERVER.Name.Lower()) %> in your browser.
Your browser shows it to SimStats every time a page with a SimStats tag loads, and SimStats then
counts nothing: no hit, no page, no address. Pages still look the same, and counters still show
their number (you just aren't in it). It works in Voyager and Simxplorer, which share their cookies.</font></p>
<p><font size="2"><b>The catch:</b> it's a cookie. If you delete your cookies (Simxplorer: View, Options),
or use another machine, SimStats can't know, and counts you again until you come back here.</font></p>
<p><font size="2">What SimStats keeps about a visit, and for how long: our <a href="privacy.htm">privacy page</a>.</font></p>
</td></tr></table>
<%= Bottom() %>
