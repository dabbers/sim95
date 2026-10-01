<%
' INDEX.ASP - the Vapor store's front page (http://<machine>/vapor/): what is
' in the store, and how to get Vapor onto another machine.
VAR line AS String
VAR p AS Array OF String
VAR here AS String
VAR rows AS String
here = SERVER.Name.Lower()
IF FS.Exists("C:\WEB\VAPOR\CATALOG.TXT") THEN
    FOR EACH line IN FS.Read("C:\WEB\VAPOR\CATALOG.TXT").Lines()
        p = line.Split("|")
        IF p.Count < 7 THEN CONTINUE
        rows = rows + "<tr><td bgcolor=""#1B2838""><font color=""#66C0F4""><b>" + SERVER.HtmlEncode(p[1]) + "</b></font><br><font size=""2"" color=""#C7D5E0"">" + SERVER.HtmlEncode(p[6].Replace("%0A", " ").Replace("%7C", "|").Replace("%25", "%")) + "</font></td>"
        IF p[4] = "soon" THEN
            rows = rows + "<td bgcolor=""#1B2838"" align=""right""><font color=""#8F98A0"">Coming soon</font></td></tr>"
        ELSE
            rows = rows + "<td bgcolor=""#1B2838"" align=""right""><font color=""#A4D007""><b>Free</b></font><br><font size=""1"" color=""#8F98A0"">" + p[5] + ", " + Str(Int(Val(p[3]) / 1024) + 1) + " KB</font></td></tr>"
        END IF
    NEXT
END IF
%><html><head><title>Vapor Store on <%= here %></title>
<meta name="description" content="Vapor, the games store for SIM95: download SimDOOM, Snake 95 and more for free, with a game library, play time and achievements.">
<meta name="keywords" content="games, video games, game store, steam, download games, free games, doom, fps, shooter, snake, arcade, library, achievements, gaming, pc games">
</head>
<body bgcolor="#171A21" text="#C7D5E0" link="#66C0F4" vlink="#66C0F4">
<table width="100%" cellpadding="8" cellspacing="0" bgcolor="#171A21"><tr><td>
<font size="6" color="#FFFFFF"><b>VAPOR</b></font> <font color="#66C0F4">store on <%= here %></font></td></tr></table>
<table width="100%" cellpadding="8" cellspacing="2">
<%= rows %>
</table>
<h3><font color="#FFFFFF">Get Vapor</font></h3>
<p>Vapor is the program that downloads and plays these games. On this machine it is
already in <tt>C:\PROGRAMS\VAPOR.SPK</tt>. To put it on another machine, paste this
into SPARK there, save it as <tt>C:\MYFILES\GETVAPOR.SPK</tt>, and press F5:</p>
<table width="100%" cellpadding="6"><tr><td bgcolor="#000000"><pre><font color="#A4D007">' GETVAPOR.SPK - copies Vapor from <%= here %> and starts it.
CONST FROM = "<%= here %>"
VAR web AS NET_Socket
VAR parts AS Array OF String
VAR done AS Bool

SUB Main ()
    TRY
        Install()
    CATCH err
    END TRY
END SUB

SUB Install ()
    VAR count AS Integer
    VAR i AS Integer
    VAR text AS String
    VAR piece AS String
    web = NET_Socket.New()
    web.onMessage = Web_OnMessage
    web.onClose = Web_OnClose
    Print("Fetching Vapor from " + FROM + "...")
    count = Int(Val(Fetch("/vapor/client.txt").Trim()))
    IF count = 0 THEN RETURN
    FOR i = 1 TO count
        piece = Fetch("/vapor/client/" + Str(i) + ".txt")
        IF piece = "" THEN RETURN
        text = text + piece
        Print("  part " + Str(i) + " of " + Str(count))
    NEXT
    FS.Write("C:\PROGRAMS\VAPOR.SPK", text)
    IF NOT FS.Exists("C:\GAMES") THEN FS.MakeDir("C:\GAMES")
    FS.Write("C:\GAMES\VAPOR.INI", "store=http://" + FROM + "/vapor/" + Chr(10))
    Print("Vapor is installed. Starting it...")
    SYS.Run("C:\PROGRAMS\VAPOR.SPK")
END SUB

FUNCTION Fetch (path AS String) AS String
    VAR conn AS NET_Connection
    VAR raw AS String
    VAR since AS Integer
    parts.Clear()
    done = FALSE
    TRY
        conn = web.Connect(FROM, 80)
    CATCH err
        Print("Could not reach " + FROM + ": " + err)
        RETURN ""
    END TRY
    conn.Send("GET " + path + " HTTP/1.0" + Chr(10) + "Host: " + FROM)
    since = SYS.Ticks
    WHILE NOT done AND SYS.Ticks - since &lt; 10000
        SYS.Sleep(50)
    END WHILE
    raw = parts.Join(Chr(10))
    IF NOT raw.StartsWith("HTTP/1.0 200") THEN
        Print("Could not fetch " + path)
        RETURN ""
    END IF
    RETURN raw.Substring(raw.IndexOf(Chr(10) + Chr(10)) + 2, raw.Length - raw.IndexOf(Chr(10) + Chr(10)) - 2)
END FUNCTION

SUB Web_OnMessage (conn AS NET_Connection, message AS String)
    parts.Add(message)
END SUB

SUB Web_OnClose (conn AS NET_Connection)
    done = TRUE
END SUB
</font></pre></td></tr></table>
<p><font size="2" color="#8F98A0">Vapor stores are just folders: any machine where the Vapor installer
ran is one. Half-Life 3 is coming soon.</font></p>
</body></html>
