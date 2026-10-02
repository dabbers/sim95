<%
' GO.ASP - the shortest way onto a new machine: 21 lines to paste into SPARK
' and run. They fetch GETVAPOR.SPK from this store and run it; that fetches
' Vapor; Vapor installs everything else.
RESPONSE.ContentType = "text/plain"
RESPONSE.Write(FS.Read("C:\WEB\VAPOR\GO.TXT").Replace("%HOST%", SERVER.Name.Lower().Split(".")[0]))
%>
