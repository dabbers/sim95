<%@ import file="WIKI.SPK" %>
<%
' INDEX.ASP - the front page: the search box, A to Z, the article of the day,
' "Did you know?" and a few doors in.
VAR day AS Integer
VAR dayText AS String
VAR dyk AS String
VAR line AS String
VAR t AS String
VAR starts AS String
LoadIndex()
day = DayArticle()
IF day > 0 THEN
    line = ArticleLine(day)
    IF line <> "" THEN
        dayText = PlainText(TextOf(line))
        IF dayText.Length > 300 THEN dayText = dayText.Substring(0, 300) + "..."
    END IF
END IF
dyk = DidYouKnow()
' a few big subjects, the ones this edition has
FOR EACH t IN ["Earth", "History", "Science", "Philosophy", "Music", "Art", "Ancient Rome", "Computer", "World Wide Web"]
    IF FindArticle(t) > 0 AND starts.Split("<br>").Count < 7 THEN starts = starts + "<a href=""article.asp?a=" + Str(FindArticle(t)) + """>" + H(t) + "</a><br>"
NEXT
%>
<%= Top("Contents") %>
<% IF articleCount = 0 THEN %>
<%= NoData() %>
<% ELSE %>
<table width="100%" cellpadding="10" cellspacing="0"><tr><td align="center">
<font face="Times New Roman" size="7" color="#000040"><b>WikiSim</b></font><font face="Times New Roman" size="6" color="#B8860B"><b> 96</b></font><br>
<font size="3" color="#404040"><i>The encyclopedia on your computer.</i> <%= articleCount %> articles, all as of 1996.</font>
<form action="search.asp" method="get"><input name="q" size="40"> <input type="submit" value="Find article"></form>
</td></tr></table>
<table width="100%" cellpadding="6" cellspacing="6"><tr>
<td valign="top" width="60%">
<%= Box("Article of the Day", "#000080", "<font size=""4""><b><a href=""article.asp?a=" + Str(day) + """>" + H(TitleOf(day)) + "</a></b></font><br>" + H(dayText) + " <a href=""article.asp?a=" + Str(day) + """>More...</a>") %>
<p>
<% IF dyk.Contains("|") THEN %>
<%= Box("Did you know?", "#006060", "..." + H(dyk.Substring(dyk.IndexOf("|") + 1, dyk.Length - dyk.IndexOf("|") - 1)) + " <font size=""2"">(<a href=""article.asp?a=" + dyk.Split("|")[0] + """>" + H(TitleOf(Int(Val(dyk.Split("|")[0])))) + "</a>)</font>") %>
<% END IF %>
</td>
<td valign="top">
<%= Box("Explore", "#800000", "<font size=""3""><a href=""random.asp""><b>Random article</b></a><br>Open the encyclopedia at any page.<p><a href=""letter.asp?l=A""><b>Browse A to Z</b></a><br>Every title, in order.<p><a href=""wikisim.htm""><b>About WikiSim</b></a><br>Where the articles come from.</font>") %>
<p>
<%= Box("Start here", "#404040", starts) %>
</td>
</tr></table>
<% END IF %>
<%= Bottom() %>
