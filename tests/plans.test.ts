import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {decodePlan,eventStatus,issueSchema,issueEventSchema,decodeIssueEvidence} from '../apps/api/src/plans';
async function pdf(pages=1){const doc=await PDFDocument.create();for(let i=0;i<pages;i++)doc.addPage([600,400]);return Buffer.from(await doc.save()).toString('base64');}
test('PDF válido: páginas y hash derivados del contenido; rechaza archivos falsos o excesivos',async()=>{
 const result=await decodePlan(await pdf(2));assert.equal(result.pageCount,2);assert.equal(result.sha256.length,64);
 await assert.rejects(()=>decodePlan(Buffer.from('<script>no pdf</script>').toString('base64')));
 await assert.rejects(()=>decodePlan(Buffer.from('%PDF-1.7 damaged').toString('base64')));
 await assert.rejects(()=>decodePlan(awaitBase64TooLarge()));
 await assert.rejects(()=>pdf(21).then(decodePlan),/20 páginas/);
});
function awaitBase64TooLarge(){return 'A'.repeat(20971524);}
test('incidencias validan coordenadas finitas, página, fecha y transiciones',()=>{
 const issue={page:1,x:0,y:1,title:'Pendiente',description:'Descripción',assignee:'Persona',dueDate:'2026-10-20',priority:'HIGH'};
 assert.equal(issueSchema.parse(issue).x,0);
 for(const extra of [{x:1.01},{y:-.1},{page:1.5},{x:NaN},{dueDate:'2026-02-30'}])assert.throws(()=>issueSchema.parse({...issue,...extra}));
 assert.equal(eventStatus('OPEN','START'),'IN_PROGRESS');assert.equal(eventStatus('OPEN','RESOLVE'),'RESOLVED');assert.equal(eventStatus('RESOLVED','REOPEN'),'OPEN');
 assert.throws(()=>eventStatus('RESOLVED','START'));assert.throws(()=>eventStatus('OPEN','REOPEN'));assert.throws(()=>eventStatus('RESOLVED','ASSIGN'));
});
test('resolver exige fotos y reasignar requiere responsable y fecha',()=>{
 assert.throws(()=>decodeIssueEvidence(issueEventSchema.parse({action:'RESOLVE',expectedRevision:0,note:'Listo'})),/foto/);
 assert.throws(()=>decodeIssueEvidence(issueEventSchema.parse({action:'ASSIGN',expectedRevision:0,note:'Cambio'})),/responsable/);
 const wav=Buffer.alloc(48);wav.write('RIFF');wav.write('WAVE',8);
 assert.throws(()=>decodeIssueEvidence(issueEventSchema.parse({action:'RESOLVE',expectedRevision:0,note:'Listo',evidence:[{name:'audio.wav',mime:'audio/wav',base64:wav.toString('base64')}]})),/JPG/);
});
