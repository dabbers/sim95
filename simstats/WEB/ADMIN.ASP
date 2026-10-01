<%@ import file="TRACK.SPK" %>
<%@ import file="STATS.SPK" %>
<%
' ADMIN.ASP - the overview, for whoever runs this machine: the user name and
' password in C:\SYSTEM\USERS.INI, asked for on every visit (so another site
' can't do anything here: it doesn't know them). Every site SimStats counts,
' whose it is, and its totals. That includes "this machine", the site the
' installer made for the SimHost front page, which belongs to nobody: the
' owner can hand it (or any site nobody has) to an account.
VAR owner AS String
VAR problem AS String
VAR allowed AS Bool
VAR line AS String
VAR id AS String
VAR who AS String
VAR home AS String
VAR all AS Array OF String
VAR today AS Integer
VAR week AS Integer
VAR month AS Integer
VAR ever AS Integer
VAR sumToday AS Integer
VAR sumWeek AS Integer
VAR sumMonth AS Integer
VAR sumEver AS Integer
VAR people AS Integer
VAR f AS String
viewer = CurrentUser()
owner = REQUEST.Form("owner").Trim()
IF REQUEST.Method = "POST" THEN
    IF NOT IsOwner(owner, REQUEST.Form("opw")) THEN
        problem = "That is not this machine's owner (the name and password in C:\SYSTEM\USERS.INI). Nothing was shown."
    ELSE
        allowed = TRUE
        IF REQUEST.Form("do") = "give" THEN
            line = SiteLine(REQUEST.Form("s").Trim().Upper())
            who = CleanName(REQUEST.Form("to"))
            IF line = "" OR SF(line, 1) <> "" THEN
                problem = "Only a site that belongs to nobody can be handed over."
            ELSEIF NOT UserExists(who) THEN
                problem = "There is no account called " + REQUEST.Form("to") + "."
            ELSE
                SetSiteField(SF(line, 0), 1, who)
                problem = SF(line, 2) + " now belongs to " + who + "."
            END IF
        END IF
    END IF
END IF
IF allowed THEN
    all = AllSites()
    home = ReadOr(DATADIR + "\HOME.TXT", "").Trim()
    IF FS.Exists(DATADIR + "\USERS") THEN
        FOR EACH f IN FS.List(DATADIR + "\USERS")
            IF NOT f.EndsWith("\") THEN people = people + 1
        NEXT
    END IF
END IF
%>
<%= Top("Machine Owner") %>
<table width="100%" cellpadding="8" cellspacing="0"><tr><td valign="top">
<%= Notice(problem) %>
<% IF NOT allowed THEN %>
<%= BoxTop("Machine Owner: All Sites") %>
<p><font size="2">Every site this SimStats counts, and their totals, for whoever runs this machine. Sign in
here with the machine's own user name and password (the ones in C:\SYSTEM\USERS.INI).</font></p>
<form action="admin.asp" method="post">
<table cellpadding="3"><tr><td><font size="2">Owner:</font></td><td><input name="owner" size="16" value="<%= H(owner) %>"></td></tr>
<tr><td><font size="2">Password:</font></td><td><input type="password" name="opw" size="16"></td></tr>
<tr><td></td><td><input type="submit" value="Show me"></td></tr></table>
</form>
<% ELSE %>
<%= BoxTop("All Sites on " + H(SERVER.Name)) %>
<p><font size="2"><%= Plural(all.Count, "site", "sites") %>, <%= Plural(people, "account", "accounts") %>.</font></p>
<table width="100%" cellpadding="3" cellspacing="0">
<tr bgcolor="#E8F0F8"><td><font size="2"><b>Site</b></font></td><td><font size="2"><b>Whose</b></font></td><td align="right"><font size="2"><b>Today</b></font></td><td align="right"><font size="2"><b>7 days</b></font></td><td align="right"><font size="2"><b>30 days</b></font></td><td align="right"><font size="2"><b>All time</b></font></td></tr>
<% FOR EACH line IN all
    id = SF(line, 0)
    today = HitsIn(id, 1)
    week = HitsIn(id, 7)
    month = HitsIn(id, 30)
    ever = TotalHits(id)
    sumToday = sumToday + today
    sumWeek = sumWeek + week
    sumMonth = sumMonth + month
    sumEver = sumEver + ever %>
<tr><td><font size="2"><b><%= H(SF(line, 2)) %></b> <tt><%= id %></tt><br><font size="1"><%= H(SF(line, 3)) %><% IF SF(line, 4) = "1" THEN %> (public)<% END IF %><% IF SF(line, 6) <> "1" THEN %> (paused)<% END IF %></font></font></td>
<td><font size="2"><% IF SF(line, 1) = "" THEN %><i>nobody</i><% IF id = home THEN %> (this machine)<% END IF %><% ELSE %><%= H(SF(line, 1)) %><% END IF %></font></td>
<td align="right"><font size="2"><%= Commas(today) %></font></td><td align="right"><font size="2"><%= Commas(week) %></font></td><td align="right"><font size="2"><%= Commas(month) %></font></td><td align="right"><font size="2"><%= Commas(ever) %></font></td></tr>
<% NEXT %>
<tr bgcolor="#E8F0F8"><td colspan="2"><font size="2"><b>Total</b></font></td><td align="right"><font size="2"><b><%= Commas(sumToday) %></b></font></td><td align="right"><font size="2"><b><%= Commas(sumWeek) %></b></font></td><td align="right"><font size="2"><b><%= Commas(sumMonth) %></b></font></td><td align="right"><font size="2"><b><%= Commas(sumEver) %></b></font></td></tr>
</table>
<br>
<%= BoxTop("Hand a Site to an Account") %>
<form action="admin.asp" method="post"><input type="hidden" name="owner" value="<%= H(owner) %>"><input type="hidden" name="do" value="give">
<p><font size="2">A site that belongs to nobody (like this machine's own) can be given to an account, which then sees its full statistics.<br>
Site id: <input name="s" size="10"> to user name: <input name="to" size="10">
Your password again: <input type="password" name="opw" size="10"> <input type="submit" value="Hand it over"></font></p>
</form>
<% END IF %>
</td></tr></table>
<%= Bottom() %>
