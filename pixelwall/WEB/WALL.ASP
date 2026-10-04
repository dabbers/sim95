<%@ import file="WALL.SPK" %>
<%
' WALL.ASP - the whole wall as a picture, 64 by 64 (pages show it bigger).
RESPONSE.Clear()
RESPONSE.ContentType = "image/x-sim95pic"
RESPONSE.Write(Picture())
RESPONSE.End()
%>
