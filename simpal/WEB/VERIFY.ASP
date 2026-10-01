<%@ import file="C:\PROGRAMS\PALCHECK.SPK" %>
<%
' VERIFY.ASP?r=R12-1A2B3C4D[&m=shop&a=4.99&o=order] - is this receipt good?
' For shops on other machines: a page can't open connections, but a SPARK
' program (Vapor, say) can fetch this. The answer is one line of plain text:
'   VALID|merchant|amount|order|buyer|date   the first time; now it is used up
'   USED|merchant|amount|order|buyer|date    somebody verified it already
'   INVALID|why                               no such receipt, or m/a/o don't match
'   BUSY|try again
' It is PalAnswer in C:\PROGRAMS\PALCHECK.SPK, the same check a shop on this
' machine makes with VerifyReceipt.
RESPONSE.ContentType = "text/plain"
RESPONSE.Clear()
RESPONSE.Write(PalAnswer(REQUEST.Query("r"), REQUEST.Query("m"), REQUEST.Query("a"), REQUEST.Query("o")))
RESPONSE.End()
%>
