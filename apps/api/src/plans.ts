import {BadRequestException,ConflictException} from '@nestjs/common';
import {createHash} from 'node:crypto';
import {PDFDocument} from 'pdf-lib';
import {z} from 'zod';
import {decodeEvidence} from './log-evidence';
export const MAX_PLAN_BYTES=15*1024*1024;
export const versionMeta={id:true,drawingId:true,number:true,label:true,note:true,name:true,size:true,sha256:true,pageCount:true,author:true,createdAt:true} as const;
export const issueEvidenceMeta={id:true,eventId:true,name:true,mime:true,size:true,sha256:true} as const;
export const issueInclude={events:{include:{evidence:{select:issueEvidenceMeta}},orderBy:{createdAt:'asc' as const}}};
export const drawingInclude={project:true,versions:{select:versionMeta,orderBy:{number:'desc' as const}}};
const text=z.string().trim().min(1).max(200);
export const dateValue=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v,'Fecha no válida');
export const planFileSchema=z.object({name:text,base64:z.string().max(20971520),label:text,note:z.string().trim().min(1).max(2000)});
export const issueSchema=z.object({page:z.number().int().min(1),x:z.number().finite().min(0).max(1),y:z.number().finite().min(0).max(1),title:text,description:z.string().trim().min(1).max(5000),assignee:text,dueDate:dateValue,priority:z.enum(['LOW','NORMAL','HIGH'])});
export const issueEventSchema=z.object({action:z.enum(['COMMENT','START','RESOLVE','REOPEN','ASSIGN']),expectedRevision:z.number().int().min(0),note:z.string().trim().min(1).max(5000),assignee:text.optional(),dueDate:dateValue.optional(),evidence:z.array(z.object({name:text,mime:text,base64:z.string().max(11184812)})).max(3).default([])});
export const safeFilename=(name:string)=>name.replace(/[\\/\x00-\x1f\x7f]/g,'_');
export async function decodePlan(base64:string){
 if(!base64||base64.length>20971520||base64.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(base64))throw new BadRequestException('PDF inválido o mayor a 15 MB');
 const content=Buffer.from(base64,'base64');
 if(content.length>MAX_PLAN_BYTES||content.toString('base64')!==base64||content.subarray(0,5).toString()!=='%PDF-')throw new BadRequestException('Selecciona un PDF válido de hasta 15 MB');
 let doc:PDFDocument;
 try{doc=await PDFDocument.load(content,{ignoreEncryption:false,throwOnInvalidObject:true,updateMetadata:false});}
 catch{throw new BadRequestException('No se pudo leer el PDF. Usa un archivo sin contraseña y sin daños.');}
 const pageCount=doc.getPageCount();if(pageCount<1||pageCount>20)throw new BadRequestException('Cada versión admite entre 1 y 20 páginas');
 if(doc.getPages().some(p=>{const {width,height}=p.getSize();return !Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||width>20000||height>20000;}))throw new BadRequestException('El tamaño de página del PDF no es compatible');
 return {content,size:content.length,pageCount,sha256:createHash('sha256').update(content).digest('hex')};
}
export function eventStatus(status:string,action:string){
 if(action==='START'){if(status!=='OPEN')throw new ConflictException('Solo puedes iniciar una incidencia abierta');return 'IN_PROGRESS';}
 if(action==='RESOLVE'){if(status==='RESOLVED')throw new ConflictException('La incidencia ya está resuelta');return 'RESOLVED';}
 if(action==='REOPEN'){if(status!=='RESOLVED')throw new ConflictException('Solo puedes reabrir una incidencia resuelta');return 'OPEN';}
 if(action==='ASSIGN'&&status==='RESOLVED')throw new ConflictException('Reabre la incidencia antes de reasignarla');
 return status;
}
export function decodeIssueEvidence(v:z.infer<typeof issueEventSchema>){
 if(v.action==='RESOLVE'&&!v.evidence.length)throw new BadRequestException('Adjunta al menos una foto de resolución');
 if(v.action==='ASSIGN'&&(!v.assignee||!v.dueDate))throw new BadRequestException('Indica responsable y vencimiento');
 const files=v.evidence.map(f=>{const decoded=decodeEvidence(f.base64,f.mime);if(!decoded.mime.startsWith('image/'))throw new BadRequestException('La evidencia de incidencias debe ser JPG, PNG o WebP');return {...decoded,name:safeFilename(f.name)};});
 if(new Set(files.map(f=>f.sha256)).size!==files.length)throw new BadRequestException('Hay fotos repetidas en esta actualización');
 if(files.reduce((n,f)=>n+f.size,0)>12*1024*1024)throw new BadRequestException('Máximo 12 MB de fotos por actualización');
 return files;
}
