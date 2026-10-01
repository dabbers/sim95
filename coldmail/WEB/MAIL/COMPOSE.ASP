<%@ import file="MAIL.SPK" %>
<%
' COMPOSE.ASP - write a letter (GET), or send it (POST). ?reply=N or ?fwd=N
' starts from a letter in folder f, quoted.
VAR toList AS String
VAR subject AS String
VAR text AS String
VAR problem AS String
VAR old AS String
VAR line AS String
VAR f AS String
RequireLogin()
IF REQUEST.Method = "POST" THEN
    RequireToken()
    toList = REQUEST.Form("to")
    subject = REQUEST.Form("subject")
    text = REQUEST.Form("text")
    problem = Send(viewer, toList, subject, text)
    IF problem = "" THEN RESPONSE.Redirect("inbox.asp?why=" + UrlEnc("Your letter is on its way."))
ELSE
    toList = REQUEST.Query("to")
    f = REQUEST.Query("f")
    IF f <> "sent" THEN f = "inbox"
    IF REQUEST.Query("reply") <> "" AND FindIndex(viewer, f, REQUEST.Query("reply")) <> "" THEN
        old = LoadLetter(viewer, REQUEST.Query("reply"))
        IF f = "sent" THEN
            toList = Header(old, "To")
        ELSE
            toList = Bare(Header(old, "From"))
        END IF
        subject = Header(old, "Subject")
        IF NOT subject.Lower().StartsWith("re:") THEN subject = "Re: " + subject
        text = Chr(10) + Chr(10) + DisplayName(Header(old, "From")) + " wrote:" + Chr(10)
        FOR EACH line IN Clip(Body(old), 3000).Lines()
            text = text + "> " + line + Chr(10)
        NEXT
    ELSEIF REQUEST.Query("fwd") <> "" AND FindIndex(viewer, f, REQUEST.Query("fwd")) <> "" THEN
        old = LoadLetter(viewer, REQUEST.Query("fwd"))
        subject = "Fwd: " + Header(old, "Subject")
        text = Chr(10) + Chr(10) + "----- Forwarded letter -----" + Chr(10) + "From: " + Header(old, "From") + Chr(10) + "Date: " + Header(old, "Date") + Chr(10) + "Subject: " + Header(old, "Subject") + Chr(10) + Chr(10) + Clip(Body(old), 5000)
    END IF
END IF
%>
<%= Top("Compose") %>
<table width="100%" cellpadding="8" cellspacing="0"><tr><td valign="top">
<%= ServerWarning() %>
<%= Notice(problem) %>
<%= BoxTop("Compose") %>
<form action="compose.asp" method="post"><%= TokenField() %>
<table cellpadding="3">
<tr><td><font size="2">From:</font></td><td><font size="2"><%= H(Field(viewer, "name")) %> &lt;<%= H(MyAddress(viewer)) %>&gt;</font></td></tr>
<tr><td><font size="2">To:</font></td><td><input name="to" size="50" maxlength="400" value="<%= H(toList) %>"></td></tr>
<tr><td><font size="2">Subject:</font></td><td><input name="subject" size="50" maxlength="<%= MAXSUBJECT %>" value="<%= H(subject) %>"></td></tr>
<tr><td valign="top"><font size="2">Letter:</font></td><td><%= LimitedBox("text", text, 14, 60, MAXBODY) %></td></tr>
<tr><td></td><td><input type="submit" id="go" value="Send"> <font size="1" color="#808080">Several people: separate them with commas.</font></td></tr>
</table>
</form>
<%= LimitScript("text", MAXBODY) %>
</td></tr></table>
<%= Bottom() %>
