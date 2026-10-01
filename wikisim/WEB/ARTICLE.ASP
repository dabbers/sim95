<%@ import file="WIKI.SPK" %>
<%
' ARTICLE.ASP?a=<id or title> - one article: its text with links to other
' articles, See also, the articles either side, and where the text came from.
VAR id AS Integer
VAR line AS String
VAR title AS String
VAR see AS String
VAR s AS String
VAR other AS String
VAR seeHtml AS String
VAR letter AS String
id = FindArticle(REQUEST.Query("a"))
IF id > 0 THEN line = ArticleLine(id)
IF line = "" THEN
    RESPONSE.Status = "404 Not Found"
ELSE
    title = line.Split("|")[1]
    letter = IndexLine(id).Split("|")[2]
    see = LineOf(Chr(10) + ReadOr(DATADIR + "\LINKS.TXT", ""), Str(id))
    IF see.Contains("|") THEN
        FOR EACH s IN see.Split("|")[1].Split(" ")
            IF s = "" THEN CONTINUE
            other = TitleOf(Int(Val(s)))
            IF other <> "" THEN seeHtml = seeHtml + "<li><a href=""article.asp?a=" + s + """>" + H(other) + "</a>" + Chr(10)
        NEXT
    END IF
END IF
%>
<% IF line = "" THEN %>
<%= Top("Not found") %>
<% IF articleCount = 0 THEN %>
<%= NoData() %>
<% ELSE %>
<h2>No such article</h2>
<p>WikiSim has no article called <b><%= H(REQUEST.Query("a")) %></b>. Perhaps it had not happened yet in 1996.</p>
<form action="search.asp" method="get">Search for it: <input name="q" size="30" value="<%= H(REQUEST.Query("a")) %>"> <input type="submit" value="Find"></form>
<% END IF %>
<% ELSE %>
<%= Top(title) %>
<table width="100%" cellpadding="8" cellspacing="0"><tr><td valign="top">
<font face="Times New Roman" size="6" color="#000040"><b><%= H(title) %></b></font>
<hr size="1" noshade>
<font size="2" color="#606060"><i>From Wikipedia, the free encyclopedia (text as of 1996, edited) &mdash; <a href="license.htm">CC BY-SA 4.0</a>. Original article: &quot;<%= H(title) %>&quot;, http://en.wikipedia.org/wiki/<%= H(title.Replace(" ", "_")) %></i></font>
<%= TextHtml(TextOf(line)) %>
<% IF seeHtml <> "" THEN %>
<h3>See also</h3>
<ul>
<%= seeHtml %></ul>
<% END IF %>
</td></tr></table>
<p><table width="100%" cellpadding="4" cellspacing="0" bgcolor="#E0E0E0"><tr>
<td width="40%"><font size="2"><% IF TitleOf(id - 1) <> "" THEN %><a href="article.asp?a=<%= id - 1 %>">&lt;&lt; <%= H(TitleOf(id - 1)) %></a><% END IF %></font></td>
<td align="center"><font size="2"><a href="letter.asp?l=<%= letter %>">More under <%= letter %></a></font></td>
<td width="40%" align="right"><font size="2"><% IF TitleOf(id + 1) <> "" THEN %><a href="article.asp?a=<%= id + 1 %>"><%= H(TitleOf(id + 1)) %> &gt;&gt;</a><% END IF %></font></td>
</tr></table>
<% END IF %>
<%= Bottom() %>
