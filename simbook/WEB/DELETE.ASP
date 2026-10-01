<%@ import file="BOOK.SPK" %>
<%
' DELETE.ASP?id=N[&r=R] - asks "are you sure?" about a post, or one reply to it
' (GET), and deletes it (POST, with the form token). The author can delete, and
' so can the owner of the Wall it is on.
VAR id AS String
VAR rid AS String
VAR post AS String
VAR reply AS String
RequireLogin()
IF REQUEST.Method = "POST" THEN
    RequireToken()
    id = REQUEST.Form("id")
    rid = REQUEST.Form("r")
ELSE
    id = REQUEST.Query("id")
    rid = REQUEST.Query("r")
END IF
post = FindPost(id)
IF post = "" THEN RESPONSE.Redirect("home.asp")
IF rid <> "" THEN
    reply = FindReply(id, rid)
    IF reply = "" OR NOT CanDeleteReply(viewer, post, reply) THEN RESPONSE.Redirect("view.asp?id=" + id)
ELSEIF NOT CanDelete(viewer, post) THEN
    RESPONSE.Redirect("view.asp?id=" + id)
END IF

IF REQUEST.Method = "POST" THEN
    IF rid <> "" THEN
        DeleteReply(id, reply)
        RESPONSE.Redirect("view.asp?id=" + id)
    END IF
    DeletePost(post)
    RESPONSE.Redirect("profile.asp?u=" + post.Split("|")[4] + "&why=" + UrlEnc("The post was deleted."))
END IF
%>
<%= Top("Delete") %>
<table width="100%" cellpadding="8" cellspacing="0"><tr><td valign="top">
<% IF rid <> "" THEN %>
<%= BoxTop("Delete this reply?") %>
<table width="100%" cellpadding="5" cellspacing="2"><%= ReplyHtml(reply, post) %></table>
<% ELSE %>
<%= BoxTop("Delete this post?") %>
<p><font size="2">Its thumbs and replies go with it<% IF IsPhoto(id) THEN %>, and so does the photo<% END IF %>. There is no undo.</font></p>
<table width="100%" cellpadding="5" cellspacing="2"><%= PostHtml(post, FALSE, "view", 2) %></table>
<% END IF %>
<form action="delete.asp" method="post"><%= TokenField() %>
<input type="hidden" name="id" value="<%= id %>">
<input type="hidden" name="r" value="<%= rid %>">
<p><input type="submit" value="Delete"> <a href="view.asp?id=<%= id %>">Cancel</a></p>
</form>
</td></tr></table>
<%= Bottom() %>
