// util - format, inspect, promisify, inherits.
function inspect(v, opts) {
  const depth = opts && typeof opts === "object" && opts.depth !== undefined ? (opts.depth === null ? 9 : opts.depth) : 2;
  return __inspect(v, depth, [0]);
}
function promisify(fn) {
  return function () {
    const args = Array.prototype.slice.call(arguments), self = this;
    return new Promise((ok, no) => {
      args.push((err, value) => (err ? no(err) : ok(value)));
      fn.apply(self, args);
    });
  };
}
function callbackify(fn) {
  return function () {
    const args = Array.prototype.slice.call(arguments), cb = args.pop();
    fn.apply(this, args).then((v) => cb(null, v), (e) => cb(e));
  };
}
function inherits(ctor, superCtor) {
  ctor.super_ = superCtor;
  Object.setPrototypeOf(ctor.prototype, superCtor.prototype);
}
function isDeepStrictEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function deprecate(fn) { return fn; }
module.exports = {
  format: __format, inspect, promisify, callbackify, inherits, isDeepStrictEqual, deprecate,
  isArray: Array.isArray,
  types: { isPromise: (p) => p instanceof Promise, isDate: (d) => d instanceof Date },
};
