// assert
class AssertionError extends Error {
  constructor(message, actual, expected, operator) {
    super(message);
    this.name = "AssertionError";
    this.code = "ERR_ASSERTION";
    this.actual = actual;
    this.expected = expected;
    this.operator = operator;
  }
}
function fail(message, actual, expected, operator, dflt) {
  if (message instanceof Error) throw message;
  throw new AssertionError(message || dflt, actual, expected, operator);
}
function assert(v, message) { if (!v) fail(message, v, true, "==", "The expression evaluated to a falsy value: " + __inspect(v, 1, [0])); }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
assert.ok = assert;
assert.AssertionError = AssertionError;
assert.fail = (m) => fail(m, undefined, undefined, "fail", "Failed");
assert.equal = (a, b, m) => { if (a != b) fail(m, a, b, "==", __inspect(a, 1, [0]) + " == " + __inspect(b, 1, [0])); };
assert.notEqual = (a, b, m) => { if (a == b) fail(m, a, b, "!=", __inspect(a, 1, [0]) + " != " + __inspect(b, 1, [0])); };
assert.strictEqual = (a, b, m) => { if (a !== b) fail(m, a, b, "strictEqual", "Expected values to be strictly equal:\n\n" + __inspect(a, 1, [0]) + " !== " + __inspect(b, 1, [0])); };
assert.notStrictEqual = (a, b, m) => { if (a === b) fail(m, a, b, "notStrictEqual", "Expected values to differ: " + __inspect(a, 1, [0])); };
assert.deepEqual = (a, b, m) => { if (!same(a, b)) fail(m, a, b, "deepEqual", "Expected values to be loosely deep-equal:\n\n" + __inspect(a, 2, [0]) + "\n\nshould loosely deep-equal\n\n" + __inspect(b, 2, [0])); };
assert.deepStrictEqual = (a, b, m) => { if (!same(a, b)) fail(m, a, b, "deepStrictEqual", "Expected values to be strictly deep-equal:\n\n" + __inspect(a, 2, [0]) + "\n\nshould equal\n\n" + __inspect(b, 2, [0])); };
assert.notDeepStrictEqual = (a, b, m) => { if (same(a, b)) fail(m, a, b, "notDeepStrictEqual", "Expected values not to be deep-equal"); };
assert.throws = (fn, expected, m) => {
  try { fn(); } catch (e) {
    if (typeof expected === "function" && expected.prototype !== undefined && !(e instanceof expected)) throw e;
    return;
  }
  fail(typeof expected === "string" ? expected : m, undefined, undefined, "throws", "Missing expected exception.");
};
assert.doesNotThrow = (fn) => fn();
assert.match = (s, re, m) => { if (String(s).indexOf(String(re)) < 0) fail(m, s, re, "match", "The input did not match: " + s); };
assert.strict = assert;
module.exports = assert;
