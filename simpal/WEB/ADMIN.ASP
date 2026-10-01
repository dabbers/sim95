<%@ import file="PAL.SPK" %>
<%
' ADMIN.ASP - the bank manager's office, for whoever runs this machine: the
' user name and password in C:\SYSTEM\USERS.INI, asked for on every visit and
' every grant (so another site can't grant anything: it doesn't know them).
' It lists every account, adds the whole ledger up again from scratch, and
' checks the money supply: all balances together must equal every welcome
' bonus plus every grant. It can also grant SimBucks: the only other way money
' is made.
VAR owner AS String
VAR problem AS String
VAR done AS String
VAR allowed AS Bool
VAR who AS Array OF String
VAR sums AS Array OF Integer
VAR issued AS Integer
VAR bonuses AS Integer
VAR grants AS Integer
VAR txs AS Integer
VAR total AS Integer
VAR rows AS String
VAR shown AS Integer
VAR listed AS Integer
VAR u AS String
VAR p AS Array OF String
VAR b AS Integer
VAR fromLedger AS Integer
VAR c AS Integer
VAR line AS String
VAR k AS Integer
VAR cents AS Integer
VAR mismatches AS Integer
viewer = CurrentUser()
owner = REQUEST.Form("owner").Trim()
IF REQUEST.Method = "POST" THEN
    IF NOT IsOwner(owner, REQUEST.Form("opw")) THEN
        problem = "That is not this machine's owner (the name and password in C:\SYSTEM\USERS.INI). Nothing was shown, and nothing was granted."
    ELSE
        allowed = TRUE
        IF REQUEST.Form("do") = "grant" THEN
            problem = Grant(REQUEST.Form("u"), REQUEST.Form("amount"), REQUEST.Form("note"))
            IF problem = "" THEN done = "Granted " + Bucks(ParseCents(REQUEST.Form("amount"))).Replace("&sect;", "§") + " to " + REQUEST.Form("u").Trim().Lower() + "."
        END IF
    END IF
END IF
IF allowed THEN
    ' Add up the whole ledger from scratch: what it says each member holds
    ' (who, sums), and how much money the bank has made (issued).
    IF LastId() > 0 THEN
        FOR c = 0 TO Int((LastId() - 1) / LOGSIZE)
            FOR EACH line IN ReadOr(DATADIR + "\LEDGER\" + Str(c) + ".TXT", "").Lines()
                p = line.Split("|")
                IF p.Count < 9 THEN CONTINUE
                txs = txs + 1
                cents = Int(Val(p[5]))
                IF p[3] = BANK THEN
                    issued = issued + cents
                    IF p[2] = "bonus" THEN bonuses = bonuses + cents
                    IF p[2] = "grant" THEN grants = grants + cents
                ELSE
                    k = who.IndexOf(p[3])
                    IF k < 0 THEN
                        who.Add(p[3])
                        sums.Add(0)
                        k = who.Count - 1
                    END IF
                    sums[k] = sums[k] - cents
                END IF
                k = who.IndexOf(p[4])
                IF k < 0 THEN
                    who.Add(p[4])
                    sums.Add(0)
                    k = who.Count - 1
                END IF
                sums[k] = sums[k] + cents
            NEXT
        NEXT
    END IF
    FOR EACH u IN People()
        p = u.Split("|")
        b = Balance(p[0])
        total = total + b
        fromLedger = 0
        IF who.IndexOf(p[0]) >= 0 THEN fromLedger = sums[who.IndexOf(p[0])]
        IF fromLedger <> b THEN mismatches = mismatches + 1
        shown = shown + 1
        IF listed < ADMINSHOW AND rows.Length < ADMINROOM THEN
            listed = listed + 1
            rows = rows + "<tr><td><font size=""2""><b>" + p[0] + "</b></font></td><td><font size=""2"">" + H(Unesc(p[1])) + "</font></td><td><font size=""2"">" + Field(LoadUser(p[0]), "joined") + "</font></td><td align=""right""><font size=""2"">" + Bucks(b) + "</font></td><td align=""right""><font size=""2"">" + Bucks(fromLedger) + "</font></td><td><font size=""2"">"
            IF fromLedger = b THEN
                rows = rows + "<font color=""#008000"">OK</font>"
            ELSE
                rows = rows + "<font color=""#CC0000""><b>DIFFERENT</b></font>"
            END IF
            rows = rows + "</font></td></tr>"
        END IF
    NEXT
    IF listed < shown THEN rows = rows + "<tr><td colspan=""6""><font size=""2"">... and " + Str(shown - listed) + " more (counted in the totals).</font></td></tr>"
END IF
%>
<%= Top("Bank Manager") %>
<table width="100%" cellpadding="8" cellspacing="0"><tr><td valign="top">
<%= BoxTop("SimPal Bank Manager") %>
<%= Notice(problem) %>
<%= Notice(done) %>
<% IF allowed THEN %>
<table cellpadding="4" cellspacing="0" border="1">
<tr><td bgcolor="#E6F0FA"><font size="2">Money supply (all balances)</font></td><td align="right"><font size="2"><b><%= Bucks(total) %></b></font></td></tr>
<tr><td bgcolor="#E6F0FA"><font size="2">Made by the bank (bonuses + grants)</font></td><td align="right"><font size="2"><b><%= Bucks(issued) %></b></font></td></tr>
<tr><td bgcolor="#E6F0FA"><font size="2">&nbsp; welcome bonuses</font></td><td align="right"><font size="2"><%= Bucks(bonuses) %></font></td></tr>
<tr><td bgcolor="#E6F0FA"><font size="2">&nbsp; grants</font></td><td align="right"><font size="2"><%= Bucks(grants) %></font></td></tr>
<tr><td bgcolor="#E6F0FA"><font size="2">Transactions in the ledger</font></td><td align="right"><font size="2"><%= txs %></font></td></tr>
<tr><td bgcolor="#E6F0FA"><font size="2">The books</font></td><td><font size="2"><b><% IF total = issued AND mismatches = 0 THEN %><font color="#008000">BALANCE</font><% ELSE %><font color="#CC0000">DO NOT BALANCE</font><% END IF %></b></font></td></tr>
</table>
<p><table width="100%" cellpadding="3" cellspacing="1">
<tr bgcolor="#E6F0FA"><td><font size="2"><b>User</b></font></td><td><font size="2"><b>Name</b></font></td><td><font size="2"><b>Joined</b></font></td><td align="right"><font size="2"><b>Balance</b></font></td><td align="right"><font size="2"><b>Ledger says</b></font></td><td></td></tr>
<%= rows %>
</table>
<%= BoxTop("Grant SimBucks") %>
<p><font size="2">Prints new money into an account. It goes in the ledger as a grant, and the money supply grows by the same amount.</font></p>
<form action="admin.asp" method="post">
<input type="hidden" name="do" value="grant">
<table cellpadding="3">
<tr><td><font size="2">To (user name):</font></td><td><input name="u" size="16"></td></tr>
<tr><td><font size="2">Amount:</font></td><td><font size="2">&sect;</font> <input name="amount" size="10"></td></tr>
<tr><td><font size="2">Note:</font></td><td><input name="note" size="40" maxlength="<%= MAXNOTE %>"></td></tr>
<tr><td><font size="2">Owner's user name:</font></td><td><input name="owner" size="16" value="<%= H(owner) %>"></td></tr>
<tr><td><font size="2">Owner's password:</font></td><td><input type="password" name="opw" size="16"> <font size="1" color="#808080">again, every time</font></td></tr>
<tr><td></td><td><input type="submit" value="Grant"></td></tr>
</table>
</form>
<% ELSE %>
<p><font size="2">This page is for whoever runs <%= H(SERVER.Name.Lower()) %>. Give the user name and password
from <tt>C:\SYSTEM\USERS.INI</tt> (the ones the Files service takes).</font></p>
<form action="admin.asp" method="post">
<table cellpadding="3">
<tr><td><font size="2">Owner's user name:</font></td><td><input name="owner" size="16" value="<%= H(owner) %>"></td></tr>
<tr><td><font size="2">Owner's password:</font></td><td><input type="password" name="opw" size="16"></td></tr>
<tr><td></td><td><input type="submit" value="Open the vault"></td></tr>
</table>
</form>
<% END IF %>
</td></tr></table>
<%= Bottom() %>
