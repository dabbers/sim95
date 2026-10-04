# cowsay

A cow says what you tell it.

## As a command

```
npm install -g cowsay
cowsay hello from SIM95
cowsay -d I have seen things
```

## In your program

```
const cowsay = require('cowsay');
console.log(cowsay.say({ text: 'Moo!', eyes: '^^' }));
console.log(cowsay.think('hmm'));
```

Uses `wrap` for the speech bubble.
