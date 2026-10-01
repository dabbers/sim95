<%@ import file="GEO.SPK" %>
<%
' EDIT.ASP - the member's own corner: their address, title and description,
' their pages, and (with ?p=name) the page editor.
'   POST do=site     title, description
'   POST do=save     p, html: a preview, or with publish=1 the page itself
'   POST do=publish  p: the preview becomes the page (from the preview's own bar)
'   POST do=new      p, tpl: another page, from a template
'   POST do=redo     p, tpl: start a page over (as a preview, so nothing is lost yet)
'   POST do=delete   p
' The member's HTML is only ever shown here inside a text box, escaped.
VAR home AS String
VAR hood AS String
VAR num AS String
VAR site AS String
VAR pg AS String
VAR html AS String
VAR problem AS String
VAR said AS String
VAR path AS String
VAR fromDraft AS Bool
VAR one AS String
VAR item AS String
VAR id AS String
VAR ring AS String
RequireLogin()
home = HomeOf(viewer)
hood = home.Split("|")[0]
num = home.Split("|")[1]
pg = REQUEST.Query("p").Lower()
IF REQUEST.Method = "POST" THEN
    RequireToken()
    pg = REQUEST.Form("p").Lower()
    SELECT CASE REQUEST.Form("do")
        CASE "site"
            IF OneLine(REQUEST.Form("title"), 1000).Length > MAXTITLE THEN
                problem = "Keep the title under " + Str(MAXTITLE) + " characters."
            ELSEIF OneLine(REQUEST.Form("desc"), 1000).Length > MAXDESC THEN
                problem = "Keep the description under " + Str(MAXDESC) + " characters."
            ELSEIF OneLine(REQUEST.Form("title"), MAXTITLE) = "" THEN
                problem = "Your homepage needs a title."
            ELSE
                UpdateSite(hood, num, OneLine(REQUEST.Form("title"), MAXTITLE), OneLine(REQUEST.Form("desc"), MAXDESC))
                RESPONSE.Redirect("edit.asp?why=" + UrlEnc("Saved. The directory shows your new title and description."))
            END IF
        CASE "save"
            IF NOT ValidPage(pg) THEN RESPONSE.Redirect("edit.asp")
            html = REQUEST.Form("html")
            problem = SavePage(hood, num, pg, html, REQUEST.Form("publish") = "")
            IF problem = "" THEN
                IF REQUEST.Form("publish") <> "" THEN RESPONSE.Redirect("edit.asp?p=" + pg + "&why=" + UrlEnc("Saved! Your page is on the Web."))
                RESPONSE.Redirect(PageLink(hood, num, pg) + "?draft=1")
            END IF
        CASE "publish"
            path = SiteData(hood, num) + "\" + pg.Upper() + ".DRF"
            IF NOT ValidPage(pg) OR NOT FS.Exists(path) THEN RESPONSE.Redirect("edit.asp")
            problem = SavePage(hood, num, pg, FS.Read(path), FALSE)
            IF problem = "" THEN RESPONSE.Redirect(PageLink(hood, num, pg))
            html = FS.Read(path)
        CASE "new"
            problem = NewPage(hood, num, pg, REQUEST.Form("tpl"), viewer)
            IF problem = "" THEN RESPONSE.Redirect("edit.asp?p=" + pg.Trim())
            pg = ""
        CASE "redo"
            IF HasPage(hood, num, pg) THEN
                problem = SavePage(hood, num, pg, FillTemplate(REQUEST.Form("tpl"), viewer, hood, num, pg), TRUE)
                IF problem = "" THEN RESPONSE.Redirect("edit.asp?p=" + pg + "&why=" + UrlEnc("Here is the template. It is only a preview until you save it."))
            END IF
        CASE "delete"
            DeletePage(hood, num, pg)
            RESPONSE.Redirect("edit.asp?why=" + UrlEnc("The page " + pg + " is gone."))
    END SELECT
ELSE
    said = REQUEST.Query("why")
    IF REQUEST.Query("new") <> "" THEN said = "Welcome to the neighborhood! Your homepage is up. Change anything you like below."
END IF
site = FindSite(hood, num)
IF pg <> "" AND NOT HasPage(hood, num, pg) THEN pg = ""
IF pg <> "" AND html = "" THEN
    path = SiteData(hood, num) + "\" + pg.Upper()
    IF FS.Exists(path + ".DRF") THEN
        html = FS.Read(path + ".DRF")
        fromDraft = TRUE
    ELSE
        html = FS.Read(path + ".HTM")
    END IF
END IF
%>
<%= Top("My Homepage", "Build your GeoSimies homepage.") %>
<table width="100%" cellpadding="8" cellspacing="0"><tr><td valign="top">
<%= Notice(problem) %><%= Notice(said) %>
<% IF pg <> "" THEN %>
<h2><font color="#000080">Editing: <%= pg %></font></h2>
<p><font size="2">This page is at <a href="<%= PageLink(hood, num, pg) %>"><%= H(FullAddress(hood, num)) %><% IF pg <> "index" THEN %><%= pg %>.asp<% END IF %></a>.
<a href="edit.asp">Back to my homepage</a></font></p>
<% IF fromDraft THEN %><p><font size="2" color="#C00000"><b>This is your preview, not saved yet.</b> Save it to put it on the Web.</font></p><% END IF %>
<form action="edit.asp" method="post"><%= TokenField() %>
<input type="hidden" name="do" value="save"><input type="hidden" name="p" value="<%= pg %>">
<%= LimitedBox("html", html, 22, 78, MAXHTML) %>
<p><input type="checkbox" name="publish" value="1"> <font size="2">Save it straight away (no preview)</font>
<input type="submit" id="go" value="Preview / Save"></p>
</form>
<%= LimitScript("html", Str(MAXHTML)) %>
<%= BoxTop("Start this page over", "#808080") %>
<form action="edit.asp" method="post"><%= TokenField() %>
<input type="hidden" name="do" value="redo"><input type="hidden" name="p" value="<%= pg %>">
<p><font size="2">From the template</font> <select name="tpl"><%= TemplateOptions() %></select> <input type="submit" value="Start Over"></p>
</form>
<% ELSE %>
<h2><font color="#000080">Welcome home, <%= H(Field(LoadUser(viewer), "name")) %>!</font></h2>
<p>Your homepage lives at <b><%= HoodInfo(hood, 1) %> <%= num %></b>:<br>
<a href="<%= SiteLink(hood, num) %>"><b><%= H(FullAddress(hood, num)) %></b></a><br>
<font size="2">or for short, <a href="~<%= viewer %>/"><%= H(SiteUrl()) %>~<%= viewer %>/</a></font></p>
<%= BoxTop("My Pages", "#000080") %>
<table cellpadding="4" cellspacing="0" width="100%">
<% FOR EACH one IN Pages(hood, num) %>
<tr><td><font size="2"><b><%= one %></b></font></td>
<td><font size="2"><%= PageHits(hood, num, one) %> visitors</font></td>
<td><font size="2"><a href="edit.asp?p=<%= one %>">Edit</a> | <a href="<%= PageLink(hood, num, one) %>">View</a></font></td>
<td><% IF one <> "index" THEN %><form action="edit.asp" method="post"><%= TokenField() %><input type="hidden" name="do" value="delete"><input type="hidden" name="p" value="<%= one %>"><input type="submit" value="Delete"></form><% END IF %></td></tr>
<% NEXT %>
</table>
<% IF Pages(hood, num).Count < MAXPAGES THEN %>
<form action="edit.asp" method="post"><%= TokenField() %>
<input type="hidden" name="do" value="new">
<p><font size="2">New page called</font> <input name="p" size="8"> <font size="2">from</font> <select name="tpl"><%= TemplateOptions() %></select> <input type="submit" value="Make It"></p>
</form>
<% END IF %>
<p><font size="2">Room for <%= MAXPAGES %> pages of up to <%= MAXHTML %> characters each.</font></p>
<%= BoxTop("Title and Description", "#000080") %>
<form action="edit.asp" method="post"><%= TokenField() %>
<input type="hidden" name="do" value="site">
<table cellpadding="3">
<tr><td><font size="2">Title:</font></td><td><input name="title" size="50" value="<%= H(SiteTitle(site)) %>"></td></tr>
<tr><td valign="top"><font size="2">Description:</font></td><td><%= LimitedBox("desc", SiteDesc(site), 3, 50, MAXDESC) %></td></tr>
<tr><td></td><td><input type="submit" id="go" value="Save"></td></tr>
</table>
<p><font size="1" color="#808080">The directory and the search engines show these. A page with no &lt;title&gt; of its own gets this one.</font></p>
</form>
<%= LimitScript("desc", Str(MAXDESC)) %>
<% END IF %>
</td><td width="250" valign="top">
<%= BoxTop("Pictures", "#008000") %>
<p><font size="2">You have <%= Pictures(hood, num).Count %> of <%= MAXPICS %>. <a href="upload.asp">Add a picture</a> or use the clip art.</font></p>
<%= BoxTop("Guestbook", "#008000") %>
<p><font size="2"><a href="guest.asp?h=<%= hood.Lower() %>&n=<%= num %>">Read my guestbook</a> (<%= GuestEntries(hood, num).Count %> entries)</font></p>
<%= BoxTop("Webrings", "#008000") %>
<p><font size="2">
<% FOR EACH id IN RingsOf(hood, num)
     ring = FindRing(id)
     IF ring <> "" THEN %><a href="ring.asp?r=<%= id %>"><%= H(RingName(ring)) %></a><br><% END IF
   NEXT %>
<a href="rings.asp">Join or start a webring</a></font></p>
<%= BoxTop("HTML Tips", "#808080") %>
<p><font size="1">
<b>&lt;!--COUNTER--&gt;</b> puts in your hit counter.<br>
<b>&lt;marquee&gt;</b>scrolling text<b>&lt;/marquee&gt;</b><br>
<b>&lt;blink&gt;</b>NEW!<b>&lt;/blink&gt;</b><br>
<b>&lt;img src="me.pic"&gt;</b> shows your picture me.pic.<br>
<b>&lt;img src="../../clipart/undercon.pic"&gt;</b> shows clip art.<br>
<b>&lt;a href="links.asp"&gt;</b> links to your page links.<br>
Your guestbook and webrings go at the bottom by themselves.<br>
Voyager's SPARK page scripts work. JavaScript is switched off here: it could read everybody's cookies.
</font></p>
</td></tr></table>
<%= Bottom() %>
