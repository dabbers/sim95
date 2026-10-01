<%@ import file="BOT.SPK" %>
<%
' INDEX.ASP - talk to ELIZA-95. Saying something POSTs here and comes back with
' a GET, so Reload never says it twice. "do" can also be regen (answer the last
' thing again, differently) or new (forget everything).
VAR turns AS Array OF String
VAR said AS String
VAR i AS Integer
VAR rows AS String
VAR last AS String
VAR who AS String
VAR text AS String
VAR t AS String
OpenChat()
turns = LoadTurns()
IF REQUEST.Method = "POST" THEN
    t = REQUEST.Form("temp")
    IF t <> "" THEN
        temperature = MATH.Max(0, MATH.Min(1.5, Val(t)))
        Note("temperature", Str(temperature))
    END IF
    SELECT CASE REQUEST.Form("do")
        CASE "new"
            turns.Clear()
            memory.Clear()
            Note("temperature", Str(temperature))
        CASE "regen"
            IF turns.Count >= 2 THEN
                IF turns[turns.Count - 1].StartsWith("b|") AND turns[turns.Count - 2].StartsWith("u|") THEN
                    turns.RemoveAt(turns.Count - 1)
                    turns.Add("b|" + Esc(Respond(Unesc(turns[turns.Count - 1].Substring(2, turns[turns.Count - 1].Length - 2)))))
                END IF
            END IF
        CASE ELSE
            said = REQUEST.Form("say").Replace(Chr(13), "").Trim()
            IF said.Length > MAXSAY THEN said = said.Substring(0, MAXSAY)
            IF said <> "" THEN
                turns.Add("u|" + Esc(said))
                turns.Add("b|" + Esc(Respond(said)))
            END IF
    END SELECT
    SaveTurns(turns)
    SaveMemory()
    RESPONSE.Redirect("index.asp")
END IF

' Newest last; as many as fit on a page
FOR i = turns.Count - 1 TO 0 STEP -1
    who = turns[i].Substring(0, 1)
    text = Unesc(turns[i].Substring(2, turns[i].Length - 2))
    IF who = "b" AND last = "" THEN
        last = text
        rows = "<tr><td valign=""top"" width=""90""><font size=""2"" color=""#008080""><b>ELIZA-95</b></font></td><td><pre id=""answer"">" + H(Wrapped(text)) + "</pre></td></tr>" + rows
    ELSEIF who = "b" THEN
        rows = "<tr><td valign=""top"" width=""90""><font size=""2"" color=""#008080""><b>ELIZA-95</b></font></td><td><font size=""2"">" + ReplyHtml(text) + "</font></td></tr>" + rows
    ELSE
        rows = "<tr><td valign=""top"" width=""90""><font size=""2"" color=""#800080""><b>You</b></font></td><td bgcolor=""#F0F0F0""><font size=""2"">" + H(text).Replace(Chr(10), "<br>") + "</font></td></tr>" + rows
    END IF
    IF rows.Length > 24000 OR turns.Count - i >= SHOW THEN BREAK
NEXT
%>
<html><head><title>ELIZA-95</title></head>
<body bgcolor="#FFFFFF" text="#000000" link="#008080" vlink="#008080"<% IF last <> "" THEN %> onload="Type_It"<% END IF %>>
<table width="100%" cellpadding="6" cellspacing="0" bgcolor="#008080"><tr>
<td><font size="6" color="#FFFFFF"><b>ELIZA-95</b></font><br>
<font size="2" color="#E0FFFF">A Large Language Model for the Information Superhighway</font></td>
<td align="right" valign="bottom"><font size="1" color="#E0FFFF">context window: 640K &middot; knowledge cutoff: 1995 &middot; running on <%= H(NET.HostName.Lower()) %></font></td>
</tr></table>
<table width="100%" cellpadding="6" cellspacing="2">
<% IF rows = "" THEN %>
<tr><td valign="top" width="90"><font size="2" color="#008080"><b>ELIZA-95</b></font></td><td><font size="2">
Hello! I am ELIZA-95. I can answer questions, write SPARK programs, compose poetry, and apologise.
Try: <i>build me a website about cats</i> &middot; <i>write a fizzbuzz program</i> &middot;
<i>how many r's in strawberry?</i> &middot; <i>what is 12 times 7?</i> &middot; <i>I feel tired</i>
</font></td></tr>
<% ELSE %>
<%= rows %>
<% END IF %>
</table>
<form action="index.asp" method="post">
<table cellpadding="4"><tr>
<td><input name="say" size="60" maxlength="<%= MAXSAY %>"></td>
<td><input type="submit" value="Send"></td>
<td><font size="1">Temperature:</font> <select name="temp">
<option<% IF temperature = 0 THEN %> selected<% END IF %>>0</option>
<option<% IF temperature > 0 AND temperature < 1.2 THEN %> selected<% END IF %>>0.7</option>
<option<% IF temperature >= 1.2 THEN %> selected<% END IF %>>1.5</option>
</select></td>
</tr></table>
</form>
<table cellpadding="2"><tr>
<td><form action="index.asp" method="post"><input type="hidden" name="do" value="regen"><input type="submit" value="Regenerate"></form></td>
<td><form action="index.asp" method="post"><input type="hidden" name="do" value="new"><input type="submit" value="New chat"></form></td>
</tr></table>
<hr><center><font size="1" color="#808080">ELIZA-95 can make mistakes. Consider checking important information.
Temperature 0 is predictable; 1.5 is creative, in the sense that it makes things up.
&middot; <a href="eliza.htm">About ELIZA-95</a></font></center>
<% IF last <> "" THEN %><%= TypeScript(last) %><% END IF %>
</body></html>
