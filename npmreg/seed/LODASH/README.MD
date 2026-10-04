# lodash

The utility belt, the parts people use most.

```
const _ = require('lodash');
_.chunk([1, 2, 3, 4, 5], 2);              // [[1, 2], [3, 4], [5]]
_.groupBy(['one', 'two', 'three'], 'length');   // {3: ['one', 'two'], 5: ['three']}
_.sortBy(users, 'age');
_.camelCase('Hello big world');           // 'helloBigWorld'
_.get(config, 'server.port', 80);
const save = _.debounce(saveNow, 500);
```

- Arrays: `chunk compact uniq uniqBy flatten flattenDeep difference intersection union without zip head last take drop range shuffle sample sum sumBy mean max min maxBy minBy`
- Collections: `groupBy countBy keyBy sortBy partition times`
- Objects: `pick omit get set has mapValues invert cloneDeep merge defaults isEqual isEmpty`
- Strings: `words capitalize upperFirst camelCase kebabCase snakeCase startCase padStart padEnd truncate escape`
- Functions: `debounce throttle once memoize`, and `clamp random inRange identity noop`
