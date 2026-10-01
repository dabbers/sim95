<%@ import file="WIKI.SPK" %>
<%
' LETTER.ASP?l=A&p=2 - every title under one letter, PERPAGE to a page (0 is
' for titles that start with a digit or a sign).
VAR want AS String
VAR pg AS Integer
VAR line AS String
VAR p AS Array OF String
VAR n AS Integer
VAR rows AS String
VAR pages AS Integer
VAR i AS Integer
VAR label AS String
want = REQUEST.Query("l").Upper()
IF want = "" THEN want = "A"
want = want.Substring(0, 1)
IF want = "0" OR NOT "ABCDEFGHIJKLMNOPQRSTUVWXYZ".Contains(want) THEN want = "#"
label = want
pg = Int(Val(REQUEST.Query("p")))
IF pg < 1 THEN pg = 1
LoadIndex()
FOR EACH line IN indexText.Split(Chr(10))
    IF NOT line.Contains("|" + want + "|") THEN CONTINUE
    p = line.Split("|")
    IF p[2] <> want THEN CONTINUE
    n = n + 1
    IF n > (pg - 1) * PERPAGE AND n <= pg * PERPAGE THEN rows = rows + "<li><a href=""article.asp?a=" + p[0] + """>" + H(p[1]) + "</a>" + Chr(10)
NEXT
pages = (n + PERPAGE - 1) / PERPAGE
%>
<%= Top("Articles under " + label) %>
<% IF articleCount = 0 THEN %>
<%= NoData() %>
<% ELSE %>
<h2>Articles under <%= H(label) %></h2>
<% IF n = 0 THEN %>
<p>No articles start with <%= H(label) %>.</p>
<% ELSE %>
<p><font size="2"><%= n %> article<% IF n <> 1 THEN %>s<% END IF %><% IF pages > 1 THEN %>, page <%= pg %> of <%= pages %><% END IF %></font></p>
<ul>
<%= rows %></ul>
<% IF pages > 1 THEN %>
<p><font size="2">Pages:
<% FOR i = 1 TO pages %>
<% IF i = pg THEN %><b><%= i %></b><% ELSE %><a href="letter.asp?l=<% IF want = "#" THEN %>0<% ELSE %><%= want %><% END IF %>&amp;p=<%= i %>"><%= i %></a><% END IF %>
<% NEXT %>
</font></p>
<% END IF %>
<% END IF %>
<% END IF %>
<%= Bottom() %>
