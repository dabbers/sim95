// events - EventEmitter, as in Node.
class EventEmitter {
  constructor() { this._events = {}; }
  _list(name) {
    if (!this._events) this._events = {};
    return this._events[name] || (this._events[name] = []);
  }
  on(name, fn) {
    if (this._events && this._events.newListener && name !== "newListener") this.emit("newListener", name, fn);
    this._list(name).push(fn);
    return this;
  }
  addListener(name, fn) { return this.on(name, fn); }
  prependListener(name, fn) { this._list(name).unshift(fn); return this; }
  once(name, fn) {
    const self = this;
    function once() { self.off(name, once); return fn.apply(self, arguments); }
    once.listener = fn;
    return this.on(name, once);
  }
  off(name, fn) {
    const l = this._list(name);
    for (let i = l.length - 1; i >= 0; i--) {
      if (l[i] === fn || l[i].listener === fn) { l.splice(i, 1); break; }
    }
    return this;
  }
  removeListener(name, fn) { return this.off(name, fn); }
  removeAllListeners(name) {
    if (name === undefined) this._events = {};
    else if (this._events) delete this._events[name];
    return this;
  }
  emit(name) {
    const l = this._list(name).slice();
    const args = Array.prototype.slice.call(arguments, 1);
    if (name === "error" && l.length === 0) {
      const e = args[0];
      throw e instanceof Error ? e : new Error("Unhandled error. (" + e + ")");
    }
    for (const fn of l) fn.apply(this, args);
    return l.length > 0;
  }
  listeners(name) { return this._list(name).map((f) => f.listener || f); }
  listenerCount(name) { return this._list(name).length; }
  eventNames() { return Object.keys(this._events || {}).filter((k) => this._events[k].length > 0); }
  setMaxListeners() { return this; }
  getMaxListeners() { return 10; }
}
EventEmitter.EventEmitter = EventEmitter;
EventEmitter.defaultMaxListeners = 10;
EventEmitter.once = function (emitter, name) {
  return new Promise((ok) => emitter.once(name, function () { ok(Array.prototype.slice.call(arguments)); }));
};
module.exports = EventEmitter;
