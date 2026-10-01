<%@ import file="MAIL.SPK" %>
<%
' DELETE.ASP - deletes the ticked letters (fields d<n>) of folder f.
VAR f AS String
VAR line AS String
VAR gone AS Integer
RequireLogin()
RequireToken()
f = REQUEST.Form("f")
IF f <> "sent" THEN f = "inbox"
FOR EACH line IN Folder(viewer, f)
    IF REQUEST.Form("d" + line.Split("|")[0]) <> "" THEN
        DeleteLetter(viewer, f, line)
        gone = gone + 1
    END IF
NEXT
IF gone = 1 THEN RESPONSE.Redirect("inbox.asp?f=" + f + "&why=" + UrlEnc("1 letter deleted."))
RESPONSE.Redirect("inbox.asp?f=" + f + "&why=" + UrlEnc(Str(gone) + " letters deleted."))
%>
