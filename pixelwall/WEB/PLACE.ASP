<%@ import file="WALL.SPK" %>
<%
' PLACE.ASP - one pixel: x and y (0-63) and c (0-15).
'   GET (a link, from Voyager): back to the page, with how it went in m
'   POST (Simxplorer's XMLHttpRequest): OK, WAIT, BUSY or BAD on the first
'        line, then the state of region r, as DATA.ASP gives it
VAR x AS Integer
VAR y AS Integer
VAR c AS Integer
VAR r AS Integer
VAR said AS String
VAR agent AS String
' Robots don't get to draw: AskSim's crawler follows every link, and each
' square is one, so it once put Black pixels on the wall from STARTHERE.
agent = REQUEST.Header("User-Agent").Lower()
IF agent.Contains("asksim") OR agent.Contains("bot") OR agent.Contains("crawl") OR agent.Contains("spider") THEN
    RESPONSE.Clear()
    RESPONSE.Status = "403 Forbidden"
    RESPONSE.ContentType = "text/plain"
    RESPONSE.Write("Robots don't get to draw on the wall.")
    RESPONSE.End()
END IF
IF REQUEST.Method = "POST" THEN
    x = Num(REQUEST.Form("x"), 0, SIZE - 1, -1)
    y = Num(REQUEST.Form("y"), 0, SIZE - 1, -1)
    c = Num(REQUEST.Form("c"), 0, 15, -1)
    r = Num(REQUEST.Form("r"), 0, 15, 5)
ELSE
    x = Num(REQUEST.Query("x"), 0, SIZE - 1, -1)
    y = Num(REQUEST.Query("y"), 0, SIZE - 1, -1)
    c = Num(REQUEST.Query("c"), 0, 15, -1)
    r = Num(REQUEST.Query("r"), 0, 15, 5)
END IF
IF x < 0 OR y < 0 OR c < 0 THEN
    said = "BAD"
ELSE
    said = Place(REQUEST.From, x, y, c)
END IF
IF REQUEST.Method = "POST" THEN
    RESPONSE.Clear()
    RESPONSE.ContentType = "text/plain"
    RESPONSE.Write(said + Chr(10) + State(r, REQUEST.From))
    RESPONSE.End()
END IF
IF c < 0 THEN c = 0
RESPONSE.Redirect("index.asp?r=" + Str(r) + "&c=" + Str(c) + "&m=" + said.Lower() + "&x=" + Str(x) + "&y=" + Str(y))
%>
