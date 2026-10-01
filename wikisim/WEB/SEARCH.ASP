<%@ import file="WIKI.SPK" %>
<%
' SEARCH.ASP?q=words - titles that start with the words first, then titles
' that hold every word, then articles whose text does. Each list is one pass
' over INDEX.TXT or the volumes, so the page stays well inside its time limit.
VAR q AS String
VAR words AS Array OF String
VAR w AS String
VAR lines AS Array OF String
VAR line AS String
VAR low AS String
VAR p AS Array OF String
VAR seen AS String
VAR rows AS String
VAR hits AS Integer
VAR textHits AS Integer
VAR vol AS Integer
VAR name AS String
VAR allIn AS Bool
VAR snippet AS String
q = REQUEST.Query("q").Replace("|", " ").Replace("{", " ").Trim()
IF q.Length > 60 THEN q = q.Substring(0, 60)
FOR EACH w IN q.Lower().Split(" ")
    IF w.Length >= 2 AND words.Count < 6 THEN words.Add(w)
NEXT
LoadIndex()
seen = "|"
IF words.Count > 0 AND articleCount > 0 THEN
    lines = indexText.Split(Chr(10))
    ' titles that start with what was typed
    FOR EACH line IN lines
        IF hits >= MAXHITS THEN BREAK
        IF NOT line.Contains("|") THEN CONTINUE
        p = line.Split("|")
        IF p[1].Lower().StartsWith(q.Lower()) THEN
            rows = rows + "<li><a href=""article.asp?a=" + p[0] + """><b>" + H(p[1]) + "</b></a>" + Chr(10)
            seen = seen + p[0] + "|"
            hits = hits + 1
        END IF
    NEXT
    ' titles with every word in them
    FOR EACH line IN lines
        IF hits >= MAXHITS THEN BREAK
        IF NOT line.Contains("|") THEN CONTINUE
        p = line.Split("|")
        IF seen.Contains("|" + p[0] + "|") THEN CONTINUE
        low = " " + p[1].Lower().Replace("(", " ").Replace(")", " ").Replace(",", " ") + " "
        allIn = TRUE
        FOR EACH w IN words
            IF NOT low.Contains(" " + w) THEN allIn = FALSE
        NEXT
        IF allIn THEN
            rows = rows + "<li><a href=""article.asp?a=" + p[0] + """><b>" + H(p[1]) + "</b></a>" + Chr(10)
            seen = seen + p[0] + "|"
            hits = hits + 1
        END IF
    NEXT
    ' articles with every word in their text
    vol = 1
    WHILE hits < MAXHITS
        name = Str(vol)
        IF name.Length < 2 THEN name = "0" + name
        IF NOT FS.Exists(DATADIR + "\VOL" + name + ".TXT") THEN BREAK
        FOR EACH line IN FS.Read(DATADIR + "\VOL" + name + ".TXT").Split(Chr(10))
            IF hits >= MAXHITS THEN BREAK
            IF NOT line.Contains("|") THEN CONTINUE
            low = line.Lower()
            allIn = TRUE
            FOR EACH w IN words
                IF NOT low.Contains(w) THEN allIn = FALSE
            NEXT
            IF NOT allIn THEN CONTINUE
            p = line.Split("|")
            IF seen.Contains("|" + p[0] + "|") THEN CONTINUE
            snippet = PlainText(TextOf(line))
            IF snippet.Length > 140 THEN snippet = snippet.Substring(0, 140) + "..."
            rows = rows + "<li><a href=""article.asp?a=" + p[0] + """>" + H(p[1]) + "</a><br><font size=""2"" color=""#606060"">" + H(snippet) + "</font>" + Chr(10)
            seen = seen + p[0] + "|"
            hits = hits + 1
            textHits = textHits + 1
        NEXT
        vol = vol + 1
    END WHILE
END IF
%>
<%= Top("Find: " + q) %>
<% IF articleCount = 0 THEN %>
<%= NoData() %>
<% ELSEIF words.Count = 0 THEN %>
<h2>Find an article</h2>
<p>Type a word or two (at least two letters each) and press Find.</p>
<% ELSEIF hits = 0 THEN %>
<h2>Nothing found for &quot;<%= H(q) %>&quot;</h2>
<p>WikiSim has no article about that. Check the spelling, try fewer words, or <a href="letter.asp?l=<%= q.Substring(0, 1).Upper() %>">browse the titles under <%= H(q.Substring(0, 1).Upper()) %></a>.
Remember that WikiSim knows only what was known in 1996.</p>
<% ELSE %>
<h2><%= hits %> article<% IF hits <> 1 THEN %>s<% END IF %> found for &quot;<%= H(q) %>&quot;</h2>
<ol>
<%= rows %></ol>
<% IF hits >= MAXHITS THEN %><p><font size="2">Only the first <%= MAXHITS %> are shown. Add a word to narrow it down.</font></p><% END IF %>
<% END IF %>
<form action="search.asp" method="get"><input name="q" size="30" value="<%= H(q) %>"> <input type="submit" value="Find"></form>
<%= Bottom() %>
