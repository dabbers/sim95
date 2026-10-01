<html>
<head>
<title>{TITLE}</title>
<meta name="description" content="The homepage of {NAME}, at {HOOD} {NUM} on GeoSimies.">
</head>
<body bgcolor="#000000" text="#FFFFFF" link="#FFFF00" vlink="#FF80FF" onload="Page_Load">
<center>
<img src="{ART}stars.pic" alt="* * * * *">
<h1><font color="#FFFF00">{TITLE}</font></h1>
<marquee bgcolor="#000080"><font color="#00FFFF"><b>*** Welcome to my homepage!!! *** Thanks for stopping by!!! *** Don't forget to sign my guestbook!!! ***</b></font></marquee>
<p>
<span id="g1"><img src="{ART}globe1.pic" alt="globe"></span><span id="g2"><img src="{ART}globe2.pic" alt="globe"></span><span id="g3"><img src="{ART}globe3.pic" alt="globe"></span><span id="g4"><img src="{ART}globe4.pic" alt="globe"></span>
</p>
<img src="{ART}rainbow.pic" alt="--------">
</center>
<h2><font color="#00FF00">About Me</font></h2>
<p>Hi! My name is <b>{NAME}</b> and this is my little corner of the information superhighway.
I live at <b>{HOOD} {NUM}</b>. <blink><font color="#FF0000">NEW!</font></blink> I just moved in!</p>
<p>Things I like:</p>
<ul>
<li>Surfing the Net</li>
<li>The X-Files</li>
<li>Computers (I have a SIM95!!!)</li>
</ul>
<center><img src="{ART}undercon.pic" alt="UNDER CONSTRUCTION"><br>
<font color="#FFFF00">This page is under construction. Come back soon!!!</font></center>
<h2><font color="#00FF00">Cool Links</font></h2>
<ul>
<li><a href="{TOP}">GeoSimies</a> - get your own free homepage!</li>
<li><a href="{TOP}hood.asp?h={KEY}">My neighbors in {HOOD}</a></li>
</ul>
<center>
<img src="{ART}rainbow.pic" alt="--------">
<p><!--COUNTER--></p>
<p><a href="{TOP}guest.asp?h={KEY}&n={NUM}#sign"><img src="{ART}emailme.pic" alt="Sign my guestbook!"></a></p>
<p><img src="{ART}bestview.pic" alt="Best viewed in Simxplorer"></p>
<font size="1">Last updated {DATE}</font>
</center>
<script type="spark">
' The globe goes round: four pictures, one shown at a time.
SUB Page_Load ()
    VAR i AS Integer
    VAR f AS Integer
    PAGE.Get("g2").Visible = FALSE
    PAGE.Get("g3").Visible = FALSE
    PAGE.Get("g4").Visible = FALSE
    FOR i = 1 TO 2000
        SYS.Sleep(250)
        PAGE.Get("g" + Str(f + 1)).Visible = FALSE
        f = (f + 1) MOD 4
        PAGE.Get("g" + Str(f + 1)).Visible = TRUE
    NEXT
END SUB
</script>
</body>
</html>
