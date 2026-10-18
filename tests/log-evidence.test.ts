import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeEvidence,transcribeAudio} from '../apps/api/src/log-evidence';
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
test('evidencia valida contenido, tamaño, MIME y base64 canónico',()=>{
 const decoded=decodeEvidence(png,'image/png');
 assert.equal(decoded.size,Buffer.from(png,'base64').length);assert.equal(decoded.sha256.length,64);
 assert.throws(()=>decodeEvidence(png,'image/jpeg'));
 assert.throws(()=>decodeEvidence(Buffer.from('<svg onload="alert(1)"/>').toString('base64'),'image/svg+xml'));
 assert.throws(()=>decodeEvidence(png+'\n','image/png'));
 assert.throws(()=>decodeEvidence('','image/png'));
 assert.throws(()=>decodeEvidence(Buffer.alloc(8*1024*1024+1).toString('base64'),'audio/wav'));
});
test('transcripción envía multipart y conserva texto para revisión, sin llamada externa',async()=>{
 const fake=(async(url:any,init:any)=>{
  assert.equal(url,'https://api.openai.com/v1/audio/transcriptions');assert.equal(init.headers.Authorization,'Bearer fake-test-key');
  assert.equal(init.body.get('language'),'es');assert.equal(init.body.get('response_format'),'json');
  assert.equal(init.body.get('file').name,'prueba.wav');
  return new Response(JSON.stringify({text:'  Colado de 12 m³.  '}),{status:200});
 }) as typeof fetch;
 assert.equal(await transcribeAudio({content:new Uint8Array([1,2]),mime:'audio/wav',name:'prueba.wav'},'fake-test-key',fake),'Colado de 12 m³.');
});
test('errores del proveedor no exponen su respuesta y texto vacío se rechaza',async()=>{
 const file={content:new Uint8Array([1]),mime:'audio/wav',name:'test.wav'};
 await assert.rejects(()=>transcribeAudio(file,'fake',async()=>new Response('private-provider-detail',{status:401})),/El servicio no pudo/);
 await assert.rejects(()=>transcribeAudio(file,'fake',async()=>new Response('{"text":""}')),/vacía/);
 await assert.rejects(()=>transcribeAudio(file,'fake',async()=>{throw new Error('secret');}),/No se pudo contactar/);
});
