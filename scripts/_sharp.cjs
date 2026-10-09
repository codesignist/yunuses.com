// sharp dogrudan bagimlilik degil, next ile geliyor. pnpm deposundaki
// surumlu klasoru elle yazmak her sharp guncellemesinde kiriliyordu;
// next'in gordugu sharp'i onun konumundan cozuyoruz.
const { createRequire } = require("node:module");

module.exports = createRequire(require.resolve("next/package.json"))("sharp");
