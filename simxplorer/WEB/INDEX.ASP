<%@ import file="SNIFF.SPK" %>
<%
' INDEX.ASP - Simxplorer's demo page (http://YOURNAME/sxdemo/): a clock and a
' counter that keep up with the server through XMLHttpRequest, without the
' page ever reloading. Other browsers are sent to get Simxplorer.
VAR gate AS String
gate = NeedsSimxplorer("3.0")
IF gate <> "" THEN
    RESPONSE.Write("<html><head><title>Simxplorer required</title></head><body bgcolor=""#008080"" text=""#FFFFFF""><br>" + gate _
        + "<p align=""center""><a href=""getsx.htm""><img src=""badge.pic"" width=""88"" height=""31"" border=""0"" alt=""Best viewed in Simxplorer""></a></p></body></html>")
    RESPONSE.End()
END IF
%><html><head><title>The Live Page</title></head>
<body bgcolor="#FFFFFF" onload="start()">
<table width="100%" cellpadding="6" cellspacing="0"><tr><td bgcolor="#000080">
<font color="#FFFF00" size="5"><b>The Live Page</b></font>
<font color="#FFFFFF" size="2">on <%= SERVER.Name.Lower() %>, served to <%= BrowserName() %> <%= BrowserVersion() %></font>
</td></tr></table>

<p>Watch this. The clock below comes from the <b>server</b>, a second at a time, and the page never reloads.
Your browser asks for it in the background with <tt>XMLHttpRequest</tt>, the trick behind tomorrow's web.</p>

<table border="2" cellpadding="8" cellspacing="0" bgcolor="#000000"><tr>
<td><font color="#00FF00" size="6"><tt><b><span id="clock">--:--:--</span></b></tt></font></td>
<td><font color="#00FF00">Visitors' requests answered:<br><font size="5"><b><span id="hits">0</span></b></font></font></td>
</tr></table>
<p><font size="2"><span id="state">Connecting to the server...</span></font></p>

<h3>Talk to the server</h3>
<p>Type something and send it. It goes by POST, and the answer lands here without a new page.</p>
<p><input id="said" size="30" onenter="shout()"> <input type="button" value="Send" onclick="shout()">
<br><b><span id="echo"></span></b></p>

<hr>
<p><a href="getsx.htm"><img src="badge.pic" width="88" height="31" border="0" alt="Best viewed in Simxplorer"></a>
<font size="2">This page is best viewed in Simxplorer 3.0 or higher, at 640x480 in 16 colours.</font></p>

<script language="JavaScript">
<!--
var answers = 0, timer;

// Simxplorer and IE 5 both know it under one name or the other
function request() {
  if (window.XMLHttpRequest) return new XMLHttpRequest();
  return new ActiveXObject("Microsoft.XMLHTTP");
}

function tick() {
  var x = request();
  x.onreadystatechange = function () {
    if (x.readyState != 4) return;
    if (x.status == 200) {
      var parts = x.responseText.split("|");
      document.getElementById("clock").innerText = parts[0];
      document.getElementById("hits").innerText = parts[1];
      answers++;
      document.getElementById("state").innerText = "Updated " + answers + " times without reloading the page.";
    } else {
      document.getElementById("state").innerText = "The server did not answer (status " + x.status + ").";
    }
  };
  x.open("GET", "time.asp?n=" + answers, true);
  x.send(null);
}

function shout() {
  var box = document.getElementById("said");
  var x = request();
  x.onreadystatechange = function () {
    if (x.readyState == 4) document.getElementById("echo").innerText = x.status == 200 ? x.responseText : "No answer.";
  };
  x.open("POST", "time.asp", true);
  x.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
  x.send("say=" + escape(box.value));
  box.value = "";
}

function start() {
  tick();
  timer = setInterval("tick()", 1000);
}
// -->
</script>
</body></html>
