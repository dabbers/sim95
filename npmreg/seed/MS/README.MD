# ms

Turn times into milliseconds, and milliseconds into times.

```
const ms = require('ms');
ms('2 days')                // 172800000
ms('1.5h')                  // 5400000
ms(60000)                   // '1m'
ms(2 * 60000, { long: true })  // '2 minutes'
setTimeout(done, ms('10s'));
```
