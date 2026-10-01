<%@ import file="MAIL.SPK" %>
<%
' JOIN.ASP - a new ColdMail address, signed in straight away, with a welcome letter.
VAR u AS String
VAR problem AS String
IF REQUEST.Method <> "POST" THEN RESPONSE.Redirect("index.asp")
u = REQUEST.Form("u").Trim().Lower()
IF REQUEST.Form("pw") <> REQUEST.Form("pw2") THEN
    problem = "The two passwords are different."
ELSE
    problem = CreateUser(u, REQUEST.Form("pw"), REQUEST.Form("name"))
END IF
IF problem <> "" THEN RESPONSE.Redirect("index.asp?e=join&why=" + UrlEnc(problem))
SaveLetter(u, "inbox", "From: ColdMail <postmaster@" + NET.HostName.Lower() + ">" + Chr(10) _
    + "To: " + MyAddress(u) + Chr(10) + "Subject: Welcome to ColdMail!" + Chr(10) _
    + "Date: " + TIME.Date + " " + TIME.Clock + Chr(10) + Chr(10) _
    + "Hello " + Field(u, "name") + "," + Chr(10) + Chr(10) _
    + "Your new address is " + MyAddress(u) + ". Give it to your friends!" + Chr(10) + Chr(10) _
    + "To write to someone on another machine, use their mail name and machine name," + Chr(10) _
    + "like bob@theirmachine. Their machine needs to be running a mail server too." + Chr(10) + Chr(10) _
    + "Stay cool," + Chr(10) + "The ColdMail team", "N")
SignIn(u)
RESPONSE.Redirect("inbox.asp")
%>
