import {BadRequestException, HttpException} from '@nestjs/common';
import {createHash} from 'node:crypto';
export const MAX_EVIDENCE_BYTES=8*1024*1024;
export const attachmentMeta={id:true,logId:true,addendumId:true,name:true,mime:true,size:true,sha256:true,caption:true,author:true,createdAt:true,transcript:true,transcriptionStatus:true,publishedAddendum:{select:{id:true}}} as const;
export function decodeEvidence(base64:string,claimedMime:string){
 if(!base64||base64.length>Math.ceil(MAX_EVIDENCE_BYTES/3)*4||base64.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(base64))throw new BadRequestException('Archivo inválido o mayor a 8 MB');
 const content=Buffer.from(base64,'base64');if(!content.length||content.length>MAX_EVIDENCE_BYTES||content.toString('base64')!==base64)throw new BadRequestException('Archivo inválido o mayor a 8 MB');
 const mime=claimedMime.split(';')[0].toLowerCase();
 const is=(at:number,hex:string)=>content.subarray(at,at+hex.length/2).toString('hex')===hex;
 const tag=(at:number,value:string)=>content.subarray(at,at+value.length).toString('ascii')===value;
 const supported:Record<string,boolean>={
  'image/jpeg':content.length>4&&is(0,'ffd8ff'),
  'image/png':content.length>24&&is(0,'89504e470d0a1a0a')&&tag(12,'IHDR'),
  'image/webp':content.length>16&&tag(0,'RIFF')&&tag(8,'WEBP'),
  'audio/webm':content.length>16&&is(0,'1a45dfa3'),
  'audio/ogg':content.length>28&&tag(0,'OggS'),
  'audio/wav':content.length>44&&tag(0,'RIFF')&&tag(8,'WAVE'),
  'audio/mpeg':content.length>10&&(tag(0,'ID3')||(content[0]===255&&(content[1]&224)===224)),
  'audio/mp4':content.length>16&&tag(4,'ftyp')
 };
 if(!supported[mime])throw new BadRequestException('Formato no admitido o contenido incompatible. Usa JPG, PNG, WebP o audio WebM, OGG, WAV, MP3 o M4A.');
 return {content,mime,size:content.length,sha256:createHash('sha256').update(content).digest('hex')};
}
export async function transcribeAudio(file:{content:Uint8Array;mime:string;name:string},key:string,fetcher:typeof fetch=fetch){
 const form=new FormData();form.set('model',process.env.TRANSCRIPTION_MODEL||'gpt-4o-mini-transcribe');form.set('language','es');form.set('response_format','json');
 form.set('file',new Blob([new Uint8Array(file.content)],{type:file.mime}),file.name);
 let response:Response;
 try{response=await fetcher('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{Authorization:`Bearer ${key}`},body:form,signal:AbortSignal.timeout(90000)});}catch{throw new HttpException('No se pudo contactar al servicio de transcripción. Tu audio sigue guardado.',502);}
 if(!response.ok)throw new HttpException('El servicio no pudo transcribir el audio. Revisa su configuración o intenta después.',502);
 const result=await response.json() as {text?:unknown};
 if(typeof result.text!=='string'||!result.text.trim()||result.text.length>10000)throw new HttpException('La transcripción está vacía o supera el límite. Usa una grabación más corta.',502);
 return result.text.trim();
}
