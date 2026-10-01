<%@ import file="TUBE.SPK" %>
<%
' UPLOAD.ASP - put a movie up (a .SMV file of up to 60K), or (to=N) add the
' next piece of a longer one to the end of your movie N.
VAR problem AS String
VAR line AS String
RequireLogin()
IF REQUEST.Method = "POST" THEN
    RequireToken()
    IF REQUEST.Form("to") <> "" THEN
        line = FindVideo(REQUEST.Form("to"))
        IF line = "" THEN RESPONSE.Redirect("index.asp")
        IF VF(line, 1) <> viewer THEN RESPONSE.Redirect("watch.asp?back=1&v=" + VF(line, 0) + "&why=" + UrlEnc("Only the person who put a movie up can add to it."))
        problem = AppendMovie(line, REQUEST.Form("movie"))
        IF problem = "" THEN problem = "The frames were added. The movie is " + RunTime(FindVideo(VF(line, 0))) + " long now."
        RESPONSE.Redirect("watch.asp?back=1&v=" + VF(line, 0) + "&why=" + UrlEnc(problem))
    END IF
    IF REQUEST.Form("movie") = "" THEN
        problem = "Choose a .SMV file to upload."
    ELSE
        problem = ImportMovie(viewer, REQUEST.Form("movie"), REQUEST.Form("title"), REQUEST.Form("about"))
        IF problem = "" THEN RESPONSE.Redirect("watch.asp?v=" + lastId)
    END IF
END IF
%>
<%= Top("Upload") %>
<table width="100%" cellpadding="8" cellspacing="0"><tr><td valign="top">
<%= Notice(problem) %>
<%= BoxTop("Upload a Movie") %>
<form action="upload.asp" method="post"><%= TokenField() %>
<table cellpadding="3">
<tr><td><font size="2">Movie file (.SMV):</font></td><td><input type="file" name="movie" size="30"></td></tr>
<tr><td><font size="2">Title:</font></td><td><input name="title" size="40" maxlength="<%= MAXTITLE %>"> <font size="1" color="#808080">(or the one in the file)</font></td></tr>
<tr><td valign="top"><font size="2">About it:</font></td><td><textarea name="about" rows="3" cols="40"></textarea></td></tr>
<tr><td></td><td><input type="submit" value="Upload"></td></tr>
</table>
</form>
<%= BoxTop("Making a Movie") %>
<p><font size="2">A SimMovie is a text file. It starts with a header and a line holding
just a full stop, then has one line for each frame, made of drawing commands
separated by semicolons:</font></p>
<pre>SIMMOVIE 1
title=My First Movie
width=160
height=120
fps=10
bg=0
.
*C12;D40,60,10;C15;T60,54,Hello!
C0;F30,50,21,21;C12;D44,60,10
C0;F34,50,21,21;C12;D48,60,10;S440,50
-</pre>
<p><font size="2">A line starting with * is a keyframe: it starts from a blank screen.
Other lines draw over the frame before; - means nothing changes. The commands:
<tt>C</tt> colour, <tt>B</tt> background, <tt>X</tt> clear, <tt>F</tt> filled box x,y,w,h,
<tt>R</tt> box, <tt>D</tt> filled circle x,y,r, <tt>O</tt> circle, <tt>L</tt> lines x1,y1,x2,y2,...,
<tt>P</tt> polygon, <tt>Q</tt> filled polygon, <tt>T</tt> text x,y,words, <tt>I</tt> picture x,y,name
and <tt>S</tt> a beep frequency,ms. A picture is a line of its own:
<tt>!name|SIM95PIC w h|row|row|...</tt>. The <a href="simtube.htm">help page</a> has the lot.</font></p>
<p><font size="2">A whole upload must fit in one 64K network message, so a movie can be up
to 60K. Longer ones go up in pieces: upload the first, then use Add More Frames on
its page for the rest. SimTube cuts every movie into 15K parts, and SimPlayer
starts playing while the rest download.</font></p>
</td></tr></table>
<%= Bottom() %>
