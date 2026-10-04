<%@ import file="WALL.SPK" %>
<%
' DATA.ASP?r=n - what the Simxplorer page asks for every few seconds: the
' version, the seconds this machine must wait, region n, and the latest pixels.
RESPONSE.Clear()
RESPONSE.ContentType = "text/plain"
RESPONSE.Write(State(Num(REQUEST.Query("r"), 0, 15, 5), REQUEST.From))
RESPONSE.End()
%>
