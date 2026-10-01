<%@ import file="ASK.SPK" %>
<%
' INDEX.ASP?q=question[&p=page][&go=1] - ask Simms. go=1 takes you straight
' to the best answer.
VAR q AS String
VAR words AS Array OF String
VAR p AS Integer
VAR i AS Integer
VAR doc AS Array OF String
VAR id AS String
VAR w AS String
VAR first AS Integer
q = REQUEST.Query("q").Trim()
IF q.Length > 200 THEN q = q.Substring(0, 200)
words = QueryWords(q)
IF words.Count > 0 THEN
    Search(words)
ELSEIF siteFilter <> "" THEN
    SiteOnly()
END IF
IF REQUEST.Query("go") = "1" AND found.Count > 0 THEN RESPONSE.Redirect(DocLine(found[0].Split("|")[1]).Split("|")[1])
p = Int(Val(REQUEST.Query("p")))
IF p < 1 THEN p = 1
first = (p - 1) * PERPAGE
%>
<% IF q = "" THEN %>
<%= Top("AskSim") %>
<center>
<table cellpadding="10"><tr>
<td><img src="simms.pic" alt="Simms the butler"></td>
<td><font size="7" color="#660099"><b>AskSim</b></font><br>
<font size="3"><i>Just ask Simms. He knows the network.</i></font></td>
</tr></table>
<p>Have a question? Type it in plain English and click <b>Ask!</b></p>
<%= AskBox("") %>
<p><font size="2">For example:
<a href="index.asp?q=Where+can+I+find+a+social+network%3F">Where can I find a social network?</a> &middot;
<a href="index.asp?q=Who+has+free+e-mail%3F">Who has free e-mail?</a> &middot;
<a href="index.asp?q=How+do+I+write+a+SPARK+program%3F">How do I write a SPARK program?</a></font></p>
</center>
<% ELSE %>
<%= Top(q + " - AskSim") %>
<table width="100%" cellpadding="6" cellspacing="0" bgcolor="#E8DDF0"><tr>
<td width="50"><a href="index.asp"><img src="simms.pic" alt="Simms"></a></td>
<td><a href="index.asp"><font size="5" color="#660099"><b>AskSim</b></font></a><br><%= AskBox(q) %></td>
</tr></table>
<p><font size="2">You asked: <b><%= H(q) %></b></font></p>
<% IF found.Count = 0 THEN %>
<table width="100%" cellpadding="8"><tr><td bgcolor="#FFF9D7"><font size="2">
<% IF words.Count = 0 AND siteFilter = "" THEN %>
I'm terribly sorry, I couldn't tell what you were looking for. Might you ask it another way, with a word or two about the subject?
<% ELSE %>
I'm terribly sorry. I've looked in every corner of the network and found nothing about
<b><%= H(words.Join(" ")) %></b><% IF siteFilter <> "" THEN %> on <b><%= H(siteFilter) %></b><% END IF %>.
Perhaps try fewer words, or <a href="addurl.asp">tell me about a site</a> I ought to visit.
<% END IF %>
</font></td></tr></table>
<% ELSE %>
<% doc = DocLine(found[0].Split("|")[1]).Split("|") %>
<% IF p = 1 THEN %>
<table width="100%" cellpadding="8"><tr><td bgcolor="#F3EEF7"><font size="2">
<b>Simms suggests:</b> <a href="<%= H(doc[1]) %>"><b><%= H(Clip(doc[2], 80)) %></b></a>
<font color="#808080">(<%= H(HostOf(doc[1])) %>)</font>
</font></td></tr></table>
<% END IF %>
<p><font size="2">Simms found <b><%= found.Count %></b> answer<% IF found.Count <> 1 THEN %>s<% END IF %>
<% IF words.Count > 0 THEN %> about <b><%= H(words.Join(" ")) %></b><% END IF %><% IF siteFilter <> "" THEN %> on <b><%= H(siteFilter) %></b><% END IF %>:</font></p>
<dl>
<% FOR i = first TO MATH.Min(first + PERPAGE, found.Count) - 1
     id = found[i].Split("|")[1]
     doc = DocLine(id).Split("|") %>
<dt><font size="3"><a href="<%= H(doc[1]) %>"><b><%= H(Clip(doc[2], 80)) %></b></a></font></dt>
<dd><font size="2"><%= Snippet(id, words) %><br>
<font color="#008000"><%= H(Clip(doc[1], 80)) %></font> &middot;
<a href="cache.asp?id=<%= id %>">Cached</a>
<% IF doc[4] = "gone" THEN %> &middot; <font color="#990000">not answering since <%= H(doc[5]) %></font><% END IF %>
</font><br><br></dd>
<% NEXT %>
</dl>
<p><font size="2">
<% IF p > 1 THEN %><a href="index.asp?q=<%= UrlEnc(q) %>&p=<%= p - 1 %>">&laquo; Previous</a> <% END IF %>
<% IF first + PERPAGE < found.Count THEN %><a href="index.asp?q=<%= UrlEnc(q) %>&p=<%= p + 1 %>">More answers &raquo;</a><% END IF %>
</font></p>
<% END IF %>
<% IF words.Count > 0 THEN %>
<table width="100%" cellpadding="6"><tr><td bgcolor="#F3EEF7"><font size="2">
<b>Simms can also answer these questions:</b><br>
<% FOR EACH w IN words %>
&middot; <a href="index.asp?q=<%= UrlEnc("Where can I find pages about " + w + "?") %>">Where can I find pages about <i><%= H(w) %></i>?</a><br>
<% NEXT %>
<% IF found.Count > 0 THEN %>
&middot; <a href="index.asp?q=<%= UrlEnc("site:" + HostOf(DocLine(found[0].Split("|")[1]).Split("|")[1])) %>">What else is on <i><%= H(HostOf(DocLine(found[0].Split("|")[1]).Split("|")[1])) %></i>?</a><br>
&middot; <a href="index.asp?q=<%= UrlEnc(q) %>&go=1">Just take me to the best answer.</a>
<% END IF %>
</font></td></tr></table>
<% END IF %>
<% END IF %>
<%= Bottom() %>
