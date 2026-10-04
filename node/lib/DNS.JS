// dns - names to addresses, through the network's name server.
function lookup(name, opts, cb) {
  if (typeof opts === "function") cb = opts;
  const id = __n.lookup(name);
  __lookups[id] = (a) => {
    if (!a) { const e = new Error("getaddrinfo ENOTFOUND " + name); e.code = "ENOTFOUND"; cb(e); return; }
    cb(null, a, 4);
  };
}
module.exports = {
  lookup,
  promises: { lookup: (name) => new Promise((ok, no) => lookup(name, (e, a) => (e ? no(e) : ok({ address: a, family: 4 })))) },
};
