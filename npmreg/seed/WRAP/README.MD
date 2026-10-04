# wrap

Word-wrap text at the spaces.

```
const wrap = require('wrap');
wrap('the quick brown fox jumps over the lazy dog', 15);
// [ 'the quick brown', 'fox jumps over', 'the lazy dog' ]
wrap.text('...', 15);    // the same, joined with line breaks
```
