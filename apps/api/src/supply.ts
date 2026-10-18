import {Prisma} from '@prisma/client';
import {D} from './domain';
type Value = Prisma.Decimal.Value;
type Need = {id:string;projectId:string;materialId:string;quantity:Value;consumed:Value;neededOn:Date;leadDays:number;status:string;createdAt:Date};
type Stock = {projectId:string;materialId:string;quantity:Value;released:Value;project:{name:string;status:string}};
type Order = {projectId:string;status:string;expectedDate:Date;lines:{materialId:string;quantity:Value;received:Value}[]};
export function supplyCoverage(needs:Need[],stocks:Stock[],orders:Order[],today:string) {
 const balances=new Map<string,Prisma.Decimal>();
 const arrivals=new Map<string,{date:string;quantity:Prisma.Decimal}[]>();
 for(const s of stocks)balances.set(`${s.projectId}/${s.materialId}`,D(s.quantity).sub(s.released));
 for(const order of orders){
  const date=order.expectedDate.toISOString().slice(0,10);
  // Overdue promises and drafts are not reliable future availability.
  if(!['APPROVED','PARTIAL'].includes(order.status)||date<today)continue;
  for(const l of order.lines){const key=`${order.projectId}/${l.materialId}`;const list=arrivals.get(key)||[];list.push({date,quantity:D(l.quantity).sub(l.received)});arrivals.set(key,list);}
 }
 for(const list of arrivals.values())list.sort((a,b)=>a.date.localeCompare(b.date));
 return needs.filter(n=>n.status==='OPEN').sort((a,b)=>a.neededOn.getTime()-b.neededOn.getTime()||a.createdAt.getTime()-b.createdAt.getTime()||a.id.localeCompare(b.id)).map(n=>{
  const key=`${n.projectId}/${n.materialId}`,neededDate=n.neededOn.toISOString().slice(0,10);
  let balance=balances.get(key)||D(0);const incoming=arrivals.get(key)||[];
  while(incoming.length&&incoming[0].date<=neededDate)balance=balance.add(incoming.shift()!.quantity);
  const remaining=D(n.quantity).sub(n.consumed),covered=Prisma.Decimal.min(remaining,Prisma.Decimal.max(0,balance));
  balances.set(key,balance.sub(covered));
  const shortage=remaining.sub(covered);
  const deadline=new Date(n.neededOn);deadline.setUTCDate(deadline.getUTCDate()-n.leadDays);
  const orderBy=deadline.toISOString().slice(0,10);
  return {needId:n.id,remaining:remaining.toString(),covered:covered.toString(),shortage:shortage.toString(),orderBy,
   urgency:shortage.eq(0)?'COVERED':neededDate<today?'OVERDUE':orderBy<=today?'BUY_NOW':'PLAN',
   alternatives:shortage.gt(0)?stocks.filter(s=>s.projectId!==n.projectId&&s.materialId===n.materialId&&s.project.status==='ACTIVE'&&D(s.released).gt(0)).map(s=>({projectId:s.projectId,projectName:s.project.name,available:D(s.released).toString()})):[]};
 });
}
