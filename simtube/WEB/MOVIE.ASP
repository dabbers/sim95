<%@ import file="TUBE.SPK" %>
<%
' MOVIE.ASP?v=N - the movie, for SimPlayer: its manifest (what it is, and
' where the parts are), as video/x-simmovie. MOVIE.ASP?v=N&p=K is part K.
VAR line AS String
VAR part AS String
RESPONSE.Clear()
line = FindVideo(REQUEST.Query("v"))
IF line = "" THEN
    RESPONSE.Status = "404 Not Found"
    RESPONSE.ContentType = "text/plain"
    RESPONSE.Write("There is no such movie on SimTube.")
    RESPONSE.End()
END IF
RESPONSE.ContentType = MIME
part = REQUEST.Query("p")
IF part = "" THEN
    RESPONSE.Write(Manifest(line))
    RESPONSE.End()
END IF
IF NOT IsNumber(part) OR NOT FS.Exists(DATADIR + "\MOVIES\" + VF(line, 0) + "\" + part + ".SMV") THEN
    RESPONSE.Status = "404 Not Found"
    RESPONSE.ContentType = "text/plain"
    RESPONSE.Write("This movie has no part " + part + ".")
    RESPONSE.End()
END IF
RESPONSE.Write(FS.Read(DATADIR + "\MOVIES\" + VF(line, 0) + "\" + part + ".SMV"))
RESPONSE.End()
%>
