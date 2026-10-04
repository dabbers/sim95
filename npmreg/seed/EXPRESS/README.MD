# express

Web servers the easy way, on Node for SIM95.

```
const express = require('express');
const app = express();

app.use(express.urlencoded());
app.use(express.static('C:\\MYFILES\\PUBLIC'));

app.get('/', (req, res) => res.send('<h1>Hello from SIM95</h1>'));
app.get('/hello/:name', (req, res) => res.send('Hello, ' + req.params.name));
app.get('/api/time', (req, res) => res.json({ now: Date.now() }));
app.post('/guestbook', (req, res) => res.redirect('/'));

app.listen(8080, () => console.log('Open http://' + require('os').hostname() + ':8080/ in Voyager'));
```

- Routes: `app.get post put delete all`, with `:params`, and `app.use` for middleware (`next()` to go on).
- `req.path query params body ip get()`
- `res.send json status set type redirect sendFile sendStatus`
- Middleware: `express.static(folder)`, `express.json()`, `express.urlencoded()`, `express.text()`

Voyager talks HTTP/1.0 to port 80 unless the address says another, like `http://alpha:8080/`.
