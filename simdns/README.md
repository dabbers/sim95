# SimDNS has moved

SimDNS was one package that made every machine its own name server,
registrar and web host. It is two now:

* **[SimNIC](../simnic/)**, on the central host STARTHERE.56k.net only: the
  network's one registrar and its name server (`NAMED.SPK`). Every machine
  asks it about names, with no setting.
* **[simweb](../simweb/)**, on every machine with a web site (from any Vapor
  store): the web server with sites by name, Personal Web Manager, `DIG` and
  the resolver.

A site at a name needs both: point the name at your machine at SimNIC, and
add the site in Personal Web Manager.

A machine that still has the old SimDNS keeps working as it was. To move to
the new way: uninstall SimDNS in Vapor first (the stock web server comes back
by itself; your `C:\WEB\VHOSTS.TXT` and `C:\WEB\SITES` stay), delete the
`C:\SYSTEM\RESOLV.INI` SimDNS wrote, so the machine asks the central name
server, and then install simweb. Register your domains again at SimNIC on
STARTHERE.56k.net: the old machine's `C:\DNS` was its own.
