<%@ import file="TUBE.SPK" %>
<%
' THUMB.ASP?v=N - a movie's picture, a SIM95PIC drawn from one of its frames when it went up.
VAR line AS String
RESPONSE.Clear()
line = FindVideo(REQUEST.Query("v"))
IF line = "" THEN
    RESPONSE.Status = "404 Not Found"
    RESPONSE.End()
END IF
RESPONSE.ContentType = "image/x-sim95pic"
RESPONSE.Write(ReadOr(DATADIR + "\MOVIES\" + VF(line, 0) + "\THUMB.PIC", ""))
RESPONSE.End()
%>
