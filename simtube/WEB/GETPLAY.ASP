<%
' GETPLAY.ASP - SimPlayer itself, as plain text, ready to save as
' C:\PROGRAMS\PLAYER.SPK (Simxplorer: File > Save As File; or copy it into SPARK).
RESPONSE.ContentType = "text/plain"
IF FS.Exists("C:\PROGRAMS\PLAYER.SPK") THEN
    RESPONSE.Write(FS.Read("C:\PROGRAMS\PLAYER.SPK"))
ELSE
    RESPONSE.Write("' SimPlayer is not on this machine. Install SimTube again to put it back.")
END IF
%>
