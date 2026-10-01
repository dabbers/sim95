<%@ import file="C:\PROGRAMS\PALCHECK.SPK" %>
<%@ import file="NIC.SPK" %>
<%
' PAID.ASP?receipt=...&order=... - SimPal sends the buyer back here. The
' receipt is checked (and used up) with PALCHECK.SPK, and the domain held
' for the order becomes the buyer's. Only linked when this machine has SimPal.
VAR order AS String
VAR info AS Array OF String
VAR d AS String
VAR who AS String
VAR said AS String
VAR good AS Bool
VAR rec AS Array OF String
viewer = CurrentUser()
order = REQUEST.Query("order").Trim()
IF order = "" OR order.Length > 8 OR NOT OnlyFrom(order, "0123456789ABCDEF") OR NOT FS.Exists(DATADIR + "\ORDERS\" + order + ".TXT") THEN
    said = "SimNIC has no order " + order + "."
ELSE
    info = FS.Read(DATADIR + "\ORDERS\" + order + ".TXT").Trim().Split("|")
    d = info[0]
    who = info[1]
    IF VerifyReceipt(REQUEST.Query("receipt"), NICPAL, NICPRICE, order) THEN
        IF NicLock() THEN
            rec = DomainRec(d)
            IF rec.Count = 0 OR rec[1] = who THEN
                Activate(who, d)
                good = TRUE
                said = "Thank you! " + d + " is registered to " + NameOf(who) + " until " + TwoYears() + "."
            ELSE
                said = "Sorry: " + d + " went to somebody else while you were paying. Your receipt is " + REQUEST.Query("receipt") + "; write to the hostmaster for a refund."
            END IF
            NicUnlock()
            FS.Delete(DATADIR + "\ORDERS\" + order + ".TXT")
        ELSE
            said = "SimNIC is very busy. Press Reload in a moment."
        END IF
    ELSEIF PalWhy = "used" AND Owns(who, d) THEN
        good = TRUE
        said = d + " is already registered to you."
    ELSE
        said = "SimPal says that receipt is no good (" + PalWhy + "), so " + d + " is not registered."
    END IF
END IF
%><%= Top("Payment") %>
<%= Notice(said, good) %>
<% IF good THEN %><p><a href="domain.asp?d=<%= UrlEnc(d) %>">Set up <%= H(d) %> now</a></p><% END IF %>
<p><a href="home.asp">My Domains</a></p>
<%= Bottom() %>
