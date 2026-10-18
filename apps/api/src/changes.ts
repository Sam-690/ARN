import {BadRequestException,ConflictException} from '@nestjs/common';
import {Prisma} from '@prisma/client';
import {z} from 'zod';
import {D,lineTotal} from './domain';
import {dateValue} from './plans';
const text=z.string().trim().min(1).max(200);
const note=z.string().trim().min(1).max(5000);
export const delta=z.union([z.string(),z.number()]).transform(String).pipe(z.string().regex(/^-?\d+(\.\d{1,2})?$/,'Usa un importe con hasta dos decimales')).refine(v=>D(v).abs().lte(100000000),'Importe fuera de rango');
export const proposalSchema=z.object({scope:note,costDelta:delta,priceDelta:delta,daysDelta:z.number().int().min(-3650).max(3650)});
export const changeSchema=z.object({projectId:text,title:text,reason:note,proposal:proposalSchema});
export const changeActionSchema=z.object({action:z.enum(['REVISE','SUBMIT','APPROVE','REJECT','CANCEL','PROGRESS','SETTLEMENT']),expectedRevision:z.number().int().min(0),note,proposal:proposalSchema.optional(),progress:z.number().int().min(0).max(100).optional(),authorizationBy:text.optional(),authorizationReference:text.optional(),amount:delta.refine(v=>D(v).gt(0),'El importe aplicado debe ser positivo').optional(),reference:text.optional(),date:dateValue.optional()});
export const changeInclude={project:true,proposals:{orderBy:{number:'desc' as const}},events:{orderBy:{createdAt:'asc' as const}},settlements:{orderBy:{createdAt:'asc' as const}}};
type Proposal={number:number;costDelta:Prisma.Decimal.Value;priceDelta:Prisma.Decimal.Value;daysDelta:number};
type Change={projectId:string;status:string;progress:number;proposals:Proposal[];settlements:{amount:Prisma.Decimal.Value}[]};
export const latestProposal=(c:{proposals:Proposal[]})=>c.proposals.reduce<Proposal|undefined>((latest,p)=>!latest||p.number>latest.number?p:latest,undefined);
export function changeBalance(c:Change){const proposal=latestProposal(c),price=D(proposal?.priceDelta||0),applied=c.settlements.reduce((n,s)=>n.add(s.amount),D(0));return {applied:applied.toFixed(2),outstanding:c.status==='APPROVED'?price.abs().sub(applied).toFixed(2):'0.00',settlementKind:price.lt(0)?'CREDIT':'COLLECTION'};}
export function projectChangeSummary(p:{id:string;startDate:Date;endDate:Date;budgetItems:{quantity:Prisma.Decimal.Value;unitPrice:Prisma.Decimal.Value}[]},changes:Change[]){
 const approved=changes.filter(c=>c.projectId===p.id&&c.status==='APPROVED'),base=p.budgetItems.reduce((n,i)=>n.add(lineTotal(i.quantity,i.unitPrice)),D(0));
 const cost=approved.reduce((n,c)=>n.add(latestProposal(c)?.costDelta||0),D(0)),price=approved.reduce((n,c)=>n.add(latestProposal(c)?.priceDelta||0),D(0)),days=approved.reduce((n,c)=>n+(latestProposal(c)?.daysDelta||0),0);
 const adjustedEnd=new Date(p.endDate);adjustedEnd.setUTCDate(adjustedEnd.getUTCDate()+days);
 if(!Number.isFinite(adjustedEnd.getTime())||adjustedEnd.getUTCFullYear()>9999)throw new BadRequestException('El plazo ajustado está fuera del rango permitido');
 return {baseBudget:base.toFixed(2),approvedCostDelta:cost.toFixed(2),adjustedBudget:base.add(cost).toFixed(2),approvedPriceDelta:price.toFixed(2),approvedDaysDelta:days,adjustedEndDate:adjustedEnd.toISOString(),approvedCount:approved.length};
}
export function changeStatus(status:string,action:string){
 if(action==='REVISE'&&['DRAFT','REJECTED'].includes(status))return 'DRAFT';
 if(action==='SUBMIT'&&status==='DRAFT')return 'SUBMITTED';
 if(action==='APPROVE'&&status==='SUBMITTED')return 'APPROVED';
 if(action==='REJECT'&&status==='SUBMITTED')return 'REJECTED';
 if(action==='CANCEL'&&['DRAFT','SUBMITTED','REJECTED'].includes(status))return 'CANCELLED';
 if(['PROGRESS','SETTLEMENT'].includes(action)&&status==='APPROVED')return status;
 throw new ConflictException('Esta acción no corresponde al estado actual del cambio');
}
