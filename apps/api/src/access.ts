import {ForbiddenException,NotFoundException,UnauthorizedException} from '@nestjs/common';
import {Prisma} from '@prisma/client';
import {z} from 'zod';
export const roles=['ADMIN','MANAGER','PURCHASING','WAREHOUSE','RESIDENT','FINANCE','VIEWER'] as const;
export const roleLabels={ADMIN:'Administración',MANAGER:'Responsable de obra',PURCHASING:'Compras',WAREHOUSE:'Almacén',RESIDENT:'Residente',FINANCE:'Finanzas',VIEWER:'Consulta'};
export const rolePermissions:Record<string,string[]>={
 ADMIN:['*'],
 MANAGER:['budget','approveBudget','approveOrder','orders','supply','stock','logs','plans','changes','approveChange','experience','validateExperience','documents'],
 PURCHASING:['orders','supply','documents'],
 WAREHOUSE:['stock','supply'],
 RESIDENT:['logs','plans','supply','changes','experience'],
 FINANCE:['payments','documents'],
 VIEWER:[]
};
export type Actor={id:string;name:string;email:string;role:string;active:boolean;mustChangePassword:boolean;revision:number;projectIds:string[]};
export const can=(actor:Pick<Actor,'role'>,permission:string)=>rolePermissions[actor.role]?.includes('*')||rolePermissions[actor.role]?.includes(permission)||false;
export const userSelect={id:true,name:true,email:true,role:true,active:true,mustChangePassword:true,revision:true,createdAt:true,memberships:{select:{projectId:true}}} as const;
export const password=z.string().min(12,'Usa al menos 12 caracteres').max(128,'Máximo 128 caracteres');
export const userSchema=z.object({name:z.string().trim().min(1).max(200),email:z.string().trim().email().max(200).transform(s=>s.toLowerCase()),role:z.enum(roles),projectIds:z.array(z.string().min(1)).max(500).refine(a=>new Set(a).size===a.length,'Obras repetidas')});
export function actorFrom(u:{id:string;name:string;email:string;role:string;active:boolean;mustChangePassword:boolean;revision:number;memberships:{projectId:string}[]}):Actor{return {id:u.id,name:u.name,email:u.email,role:u.role,active:u.active,mustChangePassword:u.mustChangePassword,revision:u.revision,projectIds:u.memberships.map(m=>m.projectId)};}
// Explicit allowlist: new routes are denied until their policy is declared.
type Rule={method:string;pattern:RegExp;permission?:string;resource?:string;bodyProjects?:string[];global?:boolean};
export const accessRules:Rule[]=[
 {method:'GET',pattern:/^data$/}, {method:'POST',pattern:/^auth\/logout$/}, {method:'POST',pattern:/^auth\/password$/},
 {method:'GET',pattern:/^users$/,permission:'users'}, {method:'POST',pattern:/^users(?:\/[^/]+(?:\/password)?)?$/,permission:'users'},
 {method:'POST',pattern:/^projects$/,permission:'projects',global:true},
 {method:'POST',pattern:/^projects\/([^/]+)\/close$/,permission:'projects',resource:'project'},
 {method:'POST',pattern:/^projects\/([^/]+)\/approve-budget$/,permission:'approveBudget',resource:'project'},
 {method:'POST',pattern:/^materials$/,permission:'materials',global:true},
 {method:'POST',pattern:/^budget$/,permission:'budget',bodyProjects:['projectId']},
 {method:'POST',pattern:/^orders$/,permission:'orders',bodyProjects:['projectId']},
 {method:'POST',pattern:/^orders\/([^/]+)\/(?:cancel)$/,permission:'orders',resource:'order'},
 {method:'POST',pattern:/^orders\/([^/]+)\/approve$/,permission:'approveOrder',resource:'order'},
 {method:'POST',pattern:/^orders\/([^/]+)\/receive$/,permission:'stock',resource:'order'},
 {method:'POST',pattern:/^orders\/([^/]+)\/pay$/,permission:'payments',resource:'order'},
 {method:'POST',pattern:/^supply\/forecast$/,bodyProjects:['projectId']},
 {method:'POST',pattern:/^supply\/needs$/,permission:'supply',bodyProjects:['projectId']},
 {method:'POST',pattern:/^supply\/needs\/([^/]+)\/cancel$/,permission:'supply',resource:'need'},
 {method:'POST',pattern:/^stock\/(?:consume|release)$/,permission:'stock',bodyProjects:['projectId']},
 {method:'POST',pattern:/^stock\/transfers$/,permission:'stock',bodyProjects:['fromProjectId','toProjectId']},
 {method:'POST',pattern:/^stock\/transfers\/([^/]+)\/receive$/,permission:'stock',resource:'transfer'},
 {method:'POST',pattern:/^changes$/,permission:'changes',bodyProjects:['projectId']},
 {method:'POST',pattern:/^changes\/([^/]+)\/actions$/,permission:'changes',resource:'change'},
 {method:'POST',pattern:/^experience\/families$/,permission:'families',global:true},
 {method:'POST',pattern:/^experience\/records$/,permission:'experience',bodyProjects:['projectId']},
 {method:'POST',pattern:/^experience\/records\/([^/]+)\/actions$/,permission:'validateExperience',resource:'experience'},
 {method:'POST',pattern:/^documents$/,permission:'documents',bodyProjects:['projectId']},
 {method:'GET',pattern:/^documents\/([^/]+)\/file$/,resource:'document'},
 {method:'POST',pattern:/^documents\/([^/]+)\/(?:extract|review|reopen|apply)$/,permission:'documents',resource:'document'},
 {method:'POST',pattern:/^drawings$/,permission:'plans',bodyProjects:['projectId']},
 {method:'POST',pattern:/^drawings\/([^/]+)\/versions(?:\/[^/]+\/issues)?$/,permission:'plans',resource:'drawing'},
 {method:'GET',pattern:/^drawings\/([^/]+)\/versions\/[^/]+\/file$/,resource:'drawing'},
 {method:'POST',pattern:/^plan-issues\/([^/]+)\/events$/,permission:'plans',resource:'issue'},
 {method:'GET',pattern:/^plan-issues\/([^/]+)\/evidence\/[^/]+$/,resource:'issue'},
 {method:'POST',pattern:/^logs$/,permission:'logs',bodyProjects:['projectId']},
 {method:'POST',pattern:/^logs\/([^/]+)\/(?:close|addenda|attachments(?:\/[^/]+\/transcribe)?)$/,permission:'logs',resource:'log'},
 {method:'GET',pattern:/^logs\/([^/]+)\/attachments\/[^/]+$/,resource:'log'}
];
export async function authorize(tx:Prisma.TransactionClient,actor:Actor,method:string,path:string,body:any){
 if(!actor.active)throw new UnauthorizedException('Cuenta desactivada');
 const route=path.replace(/^\/api\//,'').replace(/\/$/,'');
 if(actor.mustChangePassword&&!['auth/password','auth/logout'].includes(route))throw new ForbiddenException('Debes cambiar tu contraseña temporal');
 const rule=accessRules.find(r=>r.method===method&&r.pattern.test(route));if(!rule)throw new ForbiddenException('Operación no habilitada');
 let permission=rule.permission;
 if(/^changes\/[^/]+\/actions$/.test(route)){if(['APPROVE','REJECT'].includes(body?.action))permission='approveChange';else if(body?.action==='SETTLEMENT')permission='payments';}
 if(permission&&!can(actor,permission))throw new ForbiddenException('Tu perfil no permite esta operación');
 const ids:string[]=[];
 if(rule.bodyProjects)for(const key of rule.bodyProjects){if(typeof body?.[key]==='string')ids.push(body[key]);else throw new ForbiddenException('Selecciona una obra autorizada');}
 if(rule.resource){const id=decodeURIComponent(rule.pattern.exec(route)![1]);let record:any;
  switch(rule.resource){
   case 'project':record=await tx.project.findUnique({where:{id},select:{id:true}});if(record)ids.push(record.id);break;
   case 'order':record=await tx.purchaseOrder.findUnique({where:{id},select:{projectId:true}});break;
   case 'need':record=await tx.supplyNeed.findUnique({where:{id},select:{projectId:true}});break;
   case 'transfer':record=await tx.stockTransfer.findUnique({where:{id},select:{fromProjectId:true,toProjectId:true}});if(record)ids.push(record.fromProjectId,record.toProjectId);break;
   case 'change':record=await tx.changeRequest.findUnique({where:{id},select:{projectId:true}});break;
   case 'experience':record=await tx.experienceRecord.findUnique({where:{id},select:{projectId:true}});break;
   case 'document':record=await tx.sourceDocument.findUnique({where:{id},select:{projectId:true,reviewed:true}});break;
   case 'drawing':record=await tx.drawing.findUnique({where:{id},select:{projectId:true}});break;
   case 'issue':record=await tx.planIssue.findUnique({where:{id},select:{version:{select:{drawing:{select:{projectId:true}}}}}});if(record)ids.push(record.version.drawing.projectId);break;
   case 'log':record=await tx.siteLog.findUnique({where:{id},select:{projectId:true}});break;
  }
  if(!record)throw new NotFoundException('Registro no disponible');if(record.projectId)ids.push(record.projectId);
  if(rule.resource==='document'&&route.endsWith('/apply')){const kind=record.reviewed?.kind;if(kind==='QUOTE'&&!can(actor,'orders')||kind==='DELIVERY'&&!can(actor,'stock'))throw new ForbiddenException('Tu perfil no permite aplicar este tipo de documento');}
 }
 if(actor.role!=='ADMIN'&&ids.some(id=>!actor.projectIds.includes(id)))throw new ForbiddenException('No tienes acceso a esta obra');
}
