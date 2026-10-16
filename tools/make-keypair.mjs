// Makes the key pair for unlock codes.
//   node tools/make-keypair.mjs            prints a new pair, writes nothing
//   node tools/make-keypair.mjs --write    writes .keys/private.hex and prints the public key
// Put the PUBLIC key in src/lib/licenseKey.ts. Keep the PRIVATE key off the repo and off the app.
import * as ed from '@noble/ed25519';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';

const priv = ed.utils.randomPrivateKey();
const pub = await ed.getPublicKeyAsync(priv);
const privHex = ed.etc.bytesToHex(priv);
const pubHex = ed.etc.bytesToHex(pub);

if (process.argv.includes('--write')) {
  if (existsSync('.keys/private.hex') && !process.argv.includes('--force')) {
    console.error('.keys/private.hex already exists. Use --force to replace it (old codes stop working).');
    process.exit(1);
  }
  mkdirSync('.keys', { recursive: true });
  writeFileSync('.keys/private.hex', privHex + '\n');
  console.log('Private key saved to .keys/private.hex (git ignores this folder). Back it up somewhere safe.');
} else {
  console.log('PRIVATE (keep secret):', privHex);
}
console.log('PUBLIC  (goes in src/lib/licenseKey.ts):', pubHex);
