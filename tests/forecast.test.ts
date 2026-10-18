import test from 'node:test';
import assert from 'node:assert/strict';
import {forecast,forecastSchema,supplierHistory} from '../apps/api/src/forecast';
const today='2026-10-16',start=new Date('2026-09-01');
const input={projectId:'p',materialId:'m',horizon:7,leadDays:5,safetyDays:0};
const move=(id:string,date:string,quantity=28)=>({id,projectId:'p',materialId:'m',type:'OUT',quantity,createdAt:new Date(date+'T18:00:00Z'),reference:id});
const stock={projectId:'p',materialId:'m',quantity:10,released:2,averageCost:12,project:{name:'P',status:'ACTIVE'}};
const need={id:'n',projectId:'p',materialId:'m',quantity:20,consumed:0,status:'OPEN',neededOn:new Date(today),purpose:'Trabajo'};
const order={id:'o',number:1,projectId:'p',supplier:'Proveedor',status:'APPROVED',expectedDate:new Date('2026-10-18'),lines:[{materialId:'m',quantity:20,received:0}]};
test('pronóstico excluye hoy, otros materiales/obras y exige historia suficiente',()=>{
 const sources=[move('a','2026-10-10'),move('b','2026-10-11'),move('c','2026-10-12'),move('today',today,999),{...move('other','2026-10-12',999),projectId:'x'},{...move('other-material','2026-10-12',999),materialId:'x'}];
 const r=forecast(input,today,start,sources,[],[],[]);assert.equal(r.history.dailyRate,'3.0000');assert.equal(r.history.observedDays,28);assert.equal(r.required,'21.0000');assert.equal(r.history.sources.length,3);
 assert.equal(forecast(input,today,start,sources.slice(0,2),[],[],[]).history.sufficient,false);
 assert.equal(forecast(input,today,new Date('2026-10-13'),sources,[],[],[]).history.sufficient,false);
});
test('plan y tendencia no se suman; reserva preventiva y sobrantes no disponibles',()=>{
 const r=forecast({...input,safetyDays:2},today,start,[move('a','2026-10-10'),move('b','2026-10-11'),move('c','2026-10-12')],[stock],[],[need]);
 assert.equal(r.daily[0].planned,'20.0000');assert.equal(r.daily[0].trend,'3.0000');assert.equal(r.daily[0].balance,'-18.0000');assert.equal(r.required,'19.0000');assert.equal(r.orderBy,'2026-10-11');
});
test('entrada tardía no borra brecha anterior; vencidas y borradores no cubren',()=>{
 const r=forecast(input,today,start,[],[stock],[order,{...order,id:'old',expectedDate:new Date('2026-10-15')},{...order,id:'draft',status:'DRAFT',expectedDate:new Date(today)}],[need]);
 assert.equal(r.required,'12.0000');assert.equal(r.daily[0].balance,'-12.0000');assert.equal(r.daily[2].balance,'8.0000');assert.equal(r.firstShortage,today);assert.equal(r.pending.length,2);assert.equal(r.history.dailyRate,null);assert.equal(r.safety,'0.0000');
});
test('se atienden necesidades vencidas una vez, cantidades consumidas y entradas parciales',()=>{
 const r=forecast({...input,horizon:2},today,start,[],[],[{...order,status:'PARTIAL',expectedDate:new Date(today),lines:[{materialId:'m',quantity:20,received:15}]}],[{...need,neededOn:new Date('2026-10-15'),consumed:3},{...need,id:'closed',status:'CANCELLED'}]);
 assert.equal(r.daily[0].planned,'17.0000');assert.equal(r.daily[1].planned,'17.0000');assert.equal(r.required,'12.0000');assert.equal(r.pending[0].quantity,'5.0000');
});
test('optimización usa costo de origen y flete, rechaza plazo o saldo insuficiente',()=>{
 const option={kind:'BUY' as const,label:'A',unitPrice:10,freight:20,arrival:today,confirmed:true,reference:'Cotización'};
 const r=forecast({...input,comparison:{quantity:5,neededOn:today,options:[option,{...option,kind:'TRANSFER',label:'Origen',fromProjectId:'origin',unitPrice:.01,freight:5},{...option,label:'Sin confirmar',unitPrice:1,confirmed:false},{...option,label:'Tardía',unitPrice:1,arrival:'2026-10-17'},{...option,kind:'TRANSFER',fromProjectId:'missing'}]}},today,start,[],[{...stock,projectId:'origin',released:6}],[],[]);
 assert.equal(r.comparison!.recommendedIndex,1);assert.equal(r.comparison!.options[1].unitPrice,'12.0000');assert.equal(r.comparison!.options[1].total,'65.00');assert.equal(r.comparison!.saving,'5.00');assert.equal(r.comparison!.options.filter(o=>o.eligible).length,2);
 const c=forecast({...input,comparison:{quantity:7,neededOn:today,options:[{...option,kind:'TRANSFER',fromProjectId:'origin'}]}},today,start,[],[{...stock,projectId:'origin',released:6}],[],[]).comparison!;assert.equal(c.recommendedIndex,null);
});
test('proveedores concilia recibos, penaliza vencidas y excluye historia desconocida',()=>{
 const received={...order,status:'RECEIVED',expectedDate:new Date('2026-10-12')};
 const receipt={...move('in','2026-10-12',20),type:'IN',reference:'OC-1 · REC'};
 const r=supplierHistory([received,{...received,id:'unknown',number:2,supplier:' proveedor '},{...order,id:'late',number:3,expectedDate:new Date('2026-10-15')},{...order,id:'pending',number:4}], [receipt,{...receipt,reference:'OC-10 · REC'}],today,'m')[0];
 assert.equal(r.evaluated,2);assert.equal(r.onTimePercent,50);assert.equal(r.averageDelay,0);assert.equal(r.sources[1].result,'UNKNOWN');assert.equal(r.sources[2].result,'OVERDUE');assert.equal(r.sources[3].result,'PENDING');
});
test('validación limita simulaciones y rechaza fechas imposibles y cantidades fraccionarias inválidas',()=>{
 assert.equal(forecastSchema.safeParse(input).success,true);
 for(const patch of [{horizon:0},{horizon:91},{leadDays:-1},{safetyDays:31},{comparison:{quantity:1,neededOn:'2026-02-31',options:[]}},{comparison:{quantity:1.00001,neededOn:today,options:[]}}])assert.equal(forecastSchema.safeParse({...input,...patch}).success,false);
});
