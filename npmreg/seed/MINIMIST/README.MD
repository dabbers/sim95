# minimist

Parse command-line arguments.

```
const argv = require('minimist')(process.argv.slice(2));
// node app.js file.txt -x 3 -y 4 --name=beep --no-color -abc
// { _: ['file.txt'], x: 3, y: 4, name: 'beep', color: false, a: true, b: true, c: true }
```

Options: `string`, `boolean`, `alias` and `default`, as in the original.
