// timers - the global timers, as a module.
module.exports = { setTimeout, clearTimeout, setInterval, clearInterval, setImmediate, clearImmediate };
module.exports.promises = { setTimeout: (ms, v) => new Promise((ok) => setTimeout(() => ok(v), ms)) };
