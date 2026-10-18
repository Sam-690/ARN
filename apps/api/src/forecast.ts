import {Prisma} from '@prisma/client';
import {z} from 'zod';
import {D} from './domain';
type V=Prisma.Decimal.Value;
export const dateKey=(d:Date)=>d.toLocaleDateString('en-CA',{timeZone:'America/Mexico_City'});
export const plusDays=(s:string,n:number)=>{const d=new Date(s);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const days=(a:string,b:string)=>Math.round((Date.parse(b)-Date.parse(a))/86400000);
const iso=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>!isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s);
const amount=z.number().finite().min(0).max(1e8).refine(n=>Math.abs(n*10000-Math.round(n*10000))<.001,'Máximo 4 decimales');
export const forecastSchema=z.object({projectId:z.string().min(1),materialId:z.string().min(1),horizon:z.number().int().min(1).max(90),leadDays:z.number().int().min(0).max(365),safetyDays:z.number().int().min(0).max(30),comparison:z.object({quantity:amount.refine(n=>n>0),neededOn:iso,options:z.array(z.object({kind:z.enum(['BUY','TRANSFER']),label:z.string().trim().min(1).max(200),fromProjectId:z.string().optional(),unitPrice:amount,freight:amount,arrival:iso,confirmed:z.boolean(),reference:z.string().trim().max(500)})).min(1).max(10)}).optional()});
export type ForecastInput=z.infer<typeof forecastSchema>;
type Move={id:string;projectId:string;materialId:string;type:string;quantity:V;createdAt:Date;reference:string};
type Stock={projectId:string;materialId:string;quantity:V;released:V;averageCost:V;project:{name:string;status:string}};
type Order={id:string;number:number;projectId:string;supplier:string;status:string;expectedDate:Date;lines:{materialId:string;quantity:V;received:V}[]};
type Need={id:string;projectId:string;materialId:string;quantity:V;consumed:V;status:string;neededOn:Date;purpose:string};
export function forecast(v:ForecastInput,today:string,projectStart:Date,movements:Move[],stocks:Stock[],orders:Order[],needs:Need[]){
 const start=[plusDays(today,-28),projectStart.toISOString().slice(0,10)].sort().at(-1)!;
 const observedDays=Math.max(0,days(start,today));
 const sources=movements.filter(m=>m.projectId===v.projectId&&m.materialId===v.materialId&&m.type==='OUT'&&dateKey(m.createdAt)>=start&&dateKey(m.createdAt)<today);
 const activeDays=new Set(sources.map(m=>dateKey(m.createdAt))).size;
 const total=sources.reduce((s,m)=>s.add(m.quantity),D(0));
 const sufficient=observedDays>=7&&activeDays>=3;
 const rate=sufficient?total.div(observedDays):D(0),safety=rate.mul(v.safetyDays);
 const stock=stocks.find(s=>s.projectId===v.projectId&&s.materialId===v.materialId);
 const usable=Prisma.Decimal.max(0,D(stock?.quantity||0).sub(stock?.released||0));
 const planned=needs.filter(n=>n.projectId===v.projectId&&n.materialId===v.materialId&&n.status==='OPEN');
 const pending=orders.filter(o=>o.projectId===v.projectId&&['APPROVED','PARTIAL'].includes(o.status)).flatMap(o=>o.lines.filter(l=>l.materialId===v.materialId&&D(l.quantity).gt(l.received)).map(l=>({orderId:o.id,number:o.number,date:o.expectedDate.toISOString().slice(0,10),quantity:D(l.quantity).sub(l.received).toFixed(4)})));
 let demand=D(0),arrivals=D(0),required=D(0);let firstShortage:string|null=null;
 const daily=Array.from({length:v.horizon},(_,i)=>{
  const date=plusDays(today,i);
  demand=demand.add(planned.filter(n=>i===0?n.neededOn.toISOString().slice(0,10)<=date:n.neededOn.toISOString().slice(0,10)===date).reduce((s,n)=>s.add(D(n.quantity).sub(n.consumed)),D(0)));
  arrivals=arrivals.add(pending.filter(a=>a.date===date).reduce((s,a)=>s.add(a.quantity),D(0)));
  const trend=rate.mul(i+1),target=Prisma.Decimal.max(demand,trend).add(safety),balance=usable.add(arrivals).sub(target);
  const gap=Prisma.Decimal.max(0,balance.neg());required=Prisma.Decimal.max(required,gap);
  if(gap.gt(0)&&!firstShortage)firstShortage=date;
  return {date,planned:demand.toFixed(4),trend:sufficient?trend.toFixed(4):null,arrivals:arrivals.toFixed(4),balance:balance.toFixed(4),shortage:gap.toFixed(4)};
 });
 const alternatives=stocks.filter(s=>s.projectId!==v.projectId&&s.materialId===v.materialId&&s.project.status==='ACTIVE'&&D(s.released).gt(0)).map(s=>({projectId:s.projectId,name:s.project.name,available:D(s.released).toFixed(4),unitCost:D(s.averageCost).toFixed(4)}));
 let comparison=null;
 if(v.comparison){
  const c=v.comparison;
  const options=c.options.map((o,index)=>{
   const origin=alternatives.find(a=>a.projectId===o.fromProjectId),reasons:string[]=[];
   if(!o.confirmed||!o.reference)reasons.push('Falta confirmar fecha, costo y soporte');
   if(o.arrival<today)reasons.push('La llegada indicada ya pasó');
   if(o.arrival>c.neededOn)reasons.push('Llega después de la fecha necesaria');
   if(c.neededOn<today)reasons.push('La necesidad ya está vencida');
   if(o.kind==='TRANSFER'&&(!origin||D(origin.available).lt(c.quantity)))reasons.push('Sobrante liberado insuficiente en el origen');
   const price=o.kind==='TRANSFER'?D(origin?.unitCost||0):D(o.unitPrice);
   return {...o,index,unitPrice:price.toFixed(4),total:price.mul(c.quantity).add(o.freight).toFixed(2),eligible:!reasons.length,reasons};
  });
  const feasible=options.filter(o=>o.eligible).sort((a,b)=>D(a.total).cmp(b.total)||a.arrival.localeCompare(b.arrival));
  comparison={quantity:c.quantity,neededOn:c.neededOn,options,recommendedIndex:feasible[0]?.index??null,saving:feasible.length>1?D(feasible.at(-1)!.total).sub(feasible[0].total).toFixed(2):null};
 }
 return {asOf:today,generatedAt:new Date().toISOString(),projectId:v.projectId,materialId:v.materialId,horizon:v.horizon,leadDays:v.leadDays,safetyDays:v.safetyDays,history:{start,end:plusDays(today,-1),observedDays,activeDays,total:total.toFixed(4),sufficient,dailyRate:sufficient?rate.toFixed(4):null,sources:sources.map(m=>({id:m.id,date:dateKey(m.createdAt),quantity:D(m.quantity).toFixed(4),reference:m.reference}))},usable:usable.toFixed(4),safety:safety.toFixed(4),required:required.toFixed(4),firstShortage,orderBy:firstShortage?plusDays(firstShortage,-v.leadDays):null,daily,pending,needs:planned.map(n=>({id:n.id,date:n.neededOn.toISOString().slice(0,10),quantity:D(n.quantity).sub(n.consumed).toFixed(4),purpose:n.purpose})),alternatives,suppliers:supplierHistory(orders,movements,today,v.materialId),comparison};
}
// Legacy receipt linkage is restricted to the system-generated OC prefix, same project,
// and reconciled quantities per material. Unknown history never becomes an on-time sample.
export function supplierHistory(orders:Order[],movements:Move[],today:string,materialId:string){
 const groups=new Map<string,{name:string;sources:{number:number;projectId:string;due:string;completed:string|null;result:string;delay:number|null}[]}>();
 for(const o of orders.filter(o=>!['DRAFT','CANCELLED'].includes(o.status)&&o.lines.some(l=>l.materialId===materialId))){
  const key=o.supplier.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase(),g=groups.get(key)||{name:o.supplier,sources:[]};
  const due=o.expectedDate.toISOString().slice(0,10);
  let completed:string|null=null,result='PENDING',delay:number|null=null;
  if(o.status==='RECEIVED'){
   const receipts=movements.filter(m=>m.type==='IN'&&m.projectId===o.projectId&&m.reference.startsWith(`OC-${o.number} · `));
   const ids=[...new Set(o.lines.map(l=>l.materialId))];
   const reconciled=receipts.length>0&&receipts.every(m=>ids.includes(m.materialId))&&ids.every(id=>o.lines.filter(l=>l.materialId===id).reduce((s,l)=>s.add(l.quantity),D(0)).eq(receipts.filter(m=>m.materialId===id).reduce((s,m)=>s.add(m.quantity),D(0))));
   if(reconciled){completed=receipts.map(m=>dateKey(m.createdAt)).sort().at(-1)!;delay=Math.max(0,days(due,completed));result=completed<=due?'ON_TIME':'LATE';}else result='UNKNOWN';
  }else if(due<today)result='OVERDUE';
  g.sources.push({number:o.number,projectId:o.projectId,due,completed,result,delay});groups.set(key,g);
 }
 return [...groups.values()].map(g=>{const evaluated=g.sources.filter(s=>['ON_TIME','LATE','OVERDUE'].includes(s.result)),delays=g.sources.filter(s=>s.delay!==null);return {...g,evaluated:evaluated.length,onTime:evaluated.filter(s=>s.result==='ON_TIME').length,onTimePercent:evaluated.length?Math.round(evaluated.filter(s=>s.result==='ON_TIME').length/evaluated.length*100):null,averageDelay:delays.length?Number((delays.reduce((n,s)=>n+s.delay!,0)/delays.length).toFixed(1)):null};});
}
