import test from 'node:test';
import assert from 'node:assert/strict';
import {supplyCoverage} from '../apps/api/src/supply';
const day=(d:string)=>new Date(d+'T00:00:00Z');
const need=(id:string,quantity:number,neededOn='2026-10-20')=>({id,projectId:'a',materialId:'m',quantity,consumed:0,neededOn:day(neededOn),leadDays:5,status:'OPEN',createdAt:day('2026-10-12')});
const stock=(projectId:string,quantity:number,released=0)=>({projectId,materialId:'m',quantity,released,project:{name:projectId,status:'ACTIVE'}});
const order=(quantity:number,date='2026-10-19',status='APPROVED')=>({projectId:'a',status,expectedDate:day(date),lines:[{materialId:'m',quantity,received:0}]});
test('la cobertura distribuye existencias y compras una sola vez entre necesidades',()=>{
 const c=supplyCoverage([need('1',6),need('2',8,'2026-10-21')],[stock('a',5)],[order(5)],'2026-10-12');
 assert.deepEqual(c.map(c=>[c.covered,c.shortage]),[['6','0'],['4','4']]);
});
test('no supone disponibles compras tardías, vencidas, canceladas o en borrador',()=>{
 const c=supplyCoverage([need('1',10)],[stock('a',2)],[order(10,'2026-10-21'),order(10,'2026-10-11'),order(10,'2026-10-15','DRAFT'),order(10,'2026-10-15','CANCELLED')],'2026-10-12');
 assert.equal(c[0].shortage,'8');assert.equal(c[0].orderBy,'2026-10-15');assert.equal(c[0].urgency,'PLAN');
});
test('excluye liberados del consumo local y propone únicamente sobrantes declarados',()=>{
 const c=supplyCoverage([need('1',10)],[stock('a',10,4),stock('b',20,3),stock('c',100),{...stock('d',10,10),project:{name:'Cerrada',status:'CLOSED'}}],[],'2026-10-16');
 assert.equal(c[0].shortage,'4');assert.equal(c[0].urgency,'BUY_NOW');assert.deepEqual(c[0].alternatives,[{projectId:'b',projectName:'b',available:'3'}]);
});
test('resta consumos y no incluye necesidades cerradas',()=>{
 const c=supplyCoverage([{...need('1',10),consumed:6},{...need('2',9),status:'CANCELLED'}],[stock('a',2)],[],'2026-10-21');
 assert.equal(c.length,1);assert.equal(c[0].remaining,'4');assert.equal(c[0].shortage,'2');assert.equal(c[0].urgency,'OVERDUE');
});
test('respeta el orden cronológico, unidades decimales y recepción parcial',()=>{
 const c=supplyCoverage([need('2',0.3,'2026-10-22'),need('1',0.2)],[stock('a',0.1)],[{...order(0.4),lines:[{materialId:'m',quantity:0.4,received:0.1}]}],'2026-10-12');
 assert.deepEqual(c.map(x=>[x.needId,x.covered,x.shortage]),[['1','0.2','0'],['2','0.2','0.1']]);
});
