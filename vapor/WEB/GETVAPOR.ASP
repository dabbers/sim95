<%
' GETVAPOR.ASP - the program that fetches Vapor, as plain text, ready to save
' as C:\MYFILES\GETVAPOR.SPK (Simxplorer: File > Save As File).
RESPONSE.ContentType = "text/plain"
RESPONSE.Write(FS.Read("C:\WEB\VAPOR\GETVAPOR.TXT").Replace("%HOST%", SERVER.Name.Lower()))
%>
