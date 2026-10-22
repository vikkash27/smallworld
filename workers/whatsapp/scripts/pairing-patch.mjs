import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
// Backport upstream WhiskeySockets/Baileys PRs #2749 and #2765 to pinned rc14.
// Source provenance and MIT notice are in docs/whatsapp/PAIRING-COMPATIBILITY.md.
const marker = '// Small World pairing compatibility: upstream #2765';
function replaceOnce(source, before, after) {
 if (source.split(before).length !== 2) throw new Error('Baileys pairing patch layout changed; review the pinned dependency');
 return source.replace(before,after);
}
export function patchSources(socket, receive) {
 if (!socket.includes(marker)) {
  socket=replaceOnce(socket, '    // QR gen\n', `    ${marker}\n    let smallworldRefreshPairingQR;\n    // QR gen\n`);
  socket=replaceOnce(socket, '        const advB64 = creds.advSecretKey;', `        let smallworldCurrentRef;\n        smallworldRefreshPairingQR = () => {\n            if (smallworldCurrentRef && ws.isOpen) {\n                ev.emit('connection.update', { qr: buildPairingQRData(smallworldCurrentRef, noiseKeyB64, identityKeyB64, creds.advSecretKey, browser) });\n            }\n        };`);
  socket=replaceOnce(socket, "            const ref = refNode.content.toString('utf-8');", "            const ref = refNode.content.toString('utf-8');\n            smallworldCurrentRef = ref;");
  socket=replaceOnce(socket, 'buildPairingQRData(ref, noiseKeyB64, identityKeyB64, advB64, browser)', 'buildPairingQRData(ref, noiseKeyB64, identityKeyB64, creds.advSecretKey, browser)');
  socket=replaceOnce(socket, '    // device paired for the first time', `    ws.on('CB:notification,type:companion_reg_refresh', node => {\n        if (!getBinaryNodeChild(node, 'companion_reg_refresh') && !getBinaryNodeChild(node, 'pair-device-rotate-qr')) return;\n        if (creds.me) return;\n        creds.advSecretKey = randomBytes(32).toString('base64');\n        ev.emit('creds.update', { advSecretKey: creds.advSecretKey });\n        smallworldRefreshPairingQR?.();\n    });\n    // device paired for the first time`);
 }
 if (!receive.includes('buildAckStanza(node, errorCode, authState.creds.me?.id)')) {
  receive=replaceOnce(receive,'buildAckStanza(node, errorCode, authState.creds.me.id)','buildAckStanza(node, errorCode, authState.creds.me?.id)');
 }
 return {socket,receive};
}
export async function applyPairingPatch(root = resolve(dirname(fileURLToPath(import.meta.url)), '..')) {
 const lib=resolve(root,'node_modules/baileys');
 const pkg=JSON.parse(await readFile(resolve(lib,'package.json'),'utf8'));
 if (pkg.version !== '7.0.0-rc14') throw new Error('Pairing compatibility must be reviewed for this Baileys version');
 const socketFile=resolve(lib,'lib/Socket/socket.js'), receiveFile=resolve(lib,'lib/Socket/messages-recv.js');
 const socket=await readFile(socketFile,'utf8'),receive=await readFile(receiveFile,'utf8');
 const patched=patchSources(socket,receive);
 if (patched.socket!==socket) await writeFile(socketFile,patched.socket);
 if (patched.receive!==receive) await writeFile(receiveFile,patched.receive);
 console.log('Verified Baileys pairing compatibility patches (#2749, #2765).');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await applyPairingPatch();
