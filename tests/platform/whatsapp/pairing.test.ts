import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import { runInNewContext } from 'node:vm';
import { randomBytes } from 'node:crypto';
import { patchSources } from '../../../workers/whatsapp/scripts/pairing-patch.mjs';
const socketSource = readFileSync(new URL('./fixtures/pairing-original.txt', import.meta.url),'utf8');
const ackSource = readFileSync(new URL('./fixtures/ack-original.txt', import.meta.url),'utf8');
async function pairing(credsExtra: object = {}) {
 const {socket}=patchSources(socketSource,ackSource);
 const ws=Object.assign(new EventEmitter(),{isOpen:true});
 const ev=new EventEmitter(), qr:string[]=[], timers:(()=>void)[]=[];
 const creds={ noiseKey:{public:Buffer.from('noise')}, signedIdentityKey:{public:Buffer.from('identity')},advSecretKey:'retired-secret',...credsExtra };
 ev.on('connection.update',data=>qr.push(data.qr));
 ev.on('creds.update',update=>Object.assign(creds,update));
 runInNewContext(socket,{ws,ev,creds,Buffer,randomBytes,S_WHATSAPP_NET:'s.whatsapp.net',browser:['Mac OS','Chrome','14'],qrTimeout:undefined,qrTimer:undefined,
  getBinaryNodeChild:(node:{content?: {tag:string}[]},tag:string)=>node.content?.find(c=>c.tag===tag),
  getBinaryNodeChildren:(node:{content?:unknown[]})=>node.content ?? [],
  sendNode:async()=>{},buildPairingQRData:(ref:string,_noise:string,_identity:string,secret:string)=>`${ref}|${secret}`,
  setTimeout:(fn:()=>void)=>{timers.push(fn);return timers.length;},
  end:()=>{},Boom:Error,DisconnectReason:{timedOut:408}
 });
 ws.emit('CB:iq,type:set,pair-device',{attrs:{id:'iq'},content:[{tag:'pair-device',content:[{tag:'ref',content:Buffer.from('first')},{tag:'ref',content:Buffer.from('second')}]}]});
 await new Promise(resolve => setImmediate(resolve));
 return {ws,ev,qr,timers,creds};
}
it('rotates retired registration material and re-renders the same QR reference',async()=>{
 const flow=await pairing();
 expect(flow.qr).toEqual(['first|retired-secret']);
 flow.ws.emit('CB:notification,type:companion_reg_refresh',{attrs:{},content:[{tag:'pair-device-rotate-qr'}]});
 expect(flow.qr).toHaveLength(2);
 expect(flow.qr[1].startsWith('first|')).toBe(true);
 expect(flow.creds.advSecretKey).not.toBe('retired-secret');
 expect(Buffer.from(flow.creds.advSecretKey,'base64')).toHaveLength(32);
 flow.timers[0]();
 expect(flow.qr[2]).toBe(`second|${flow.creds.advSecretKey}`);
});
it('preserves the key for a paired account and ignores malformed refreshes',async()=>{
 const paired=await pairing({me:{id:'member'}});
 paired.ws.emit('CB:notification,type:companion_reg_refresh',{attrs:{},content:[{tag:'companion_reg_refresh'}]});
 expect(paired.creds.advSecretKey).toBe('retired-secret');
 const pending=await pairing();
 pending.ws.emit('CB:notification,type:companion_reg_refresh',{attrs:{},content:[{tag:'unexpected'}]});
 expect(pending.qr).toHaveLength(1);
});
it('acknowledges a pre-login notification without an account identity',async()=>{
 const {receive}=patchSources(socketSource,ackSource);
 const sent:unknown[]=[];
 const ctx={authState:{creds:{}},buildAckStanza:(node:unknown,_error:unknown,from:unknown)=>({node,from}),logger:{debug:()=>{}},sendNode:async(node:unknown)=>sent.push(node)};
 const ack=runInNewContext(`${receive};sendMessageAck`,ctx);
 await ack({tag:'notification',attrs:{id:'refresh'}});
 expect(sent).toEqual([{node:{tag:'notification',attrs:{id:'refresh'}},from:undefined}]);
});
it('applies once and refuses an unexpected dependency layout',()=>{
 const patched=patchSources(socketSource,ackSource);
 expect(patchSources(patched.socket,patched.receive)).toEqual(patched);
 expect(()=>patchSources('unexpected release',ackSource)).toThrow(/layout|patch/i);
});
