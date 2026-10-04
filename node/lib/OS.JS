// os - this machine.
module.exports = {
  EOL: "\n",
  hostname: () => process.env.HOSTNAME,
  platform: () => "sim95",
  type: () => "SIM95",
  release: () => "1.0",
  arch: () => "x86",
  homedir: () => "C:\\MYFILES",
  tmpdir: () => "C:\\MYFILES",
  uptime: () => process.uptime(),
  cpus: () => [{ model: "SIM 486DX2/66", speed: 66 }],
  totalmem: () => 16 * 1024 * 1024,
  freemem: () => 8 * 1024 * 1024,
  loadavg: () => [0, 0, 0],
  userInfo: () => ({ username: "user", homedir: "C:\\MYFILES" }),
  networkInterfaces: () => ({ modem: [{ address: __n.info("address"), family: "IPv4", internal: false }] }),
};
