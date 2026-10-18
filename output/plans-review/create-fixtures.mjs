import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {writeFile} from 'node:fs/promises';
for(const rev of [1,2]){
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
 for(let sheet=1;sheet<=(rev===1?2:1);sheet++){
  const p=doc.addPage([900,620]),ink=rgb(.12,.22,.24),muted=rgb(.45,.55,.55),teal=rgb(.15,.48,.45);
  p.drawRectangle({x:24,y:24,width:852,height:572,borderColor:ink,borderWidth:1});
  p.drawText('OBRA / PLANO DE DEMOSTRACION',{x:45,y:556,font:bold,size:19,color:ink});
  p.drawText('Datos ficticios - No usar para construccion',{x:45,y:533,font,size:11,color:muted});
  p.drawText('ARQ-DEMO   |   REV. '+rev+'   |   PAGINA '+sheet,{x:45,y:52,font:bold,size:12,color:ink});
  p.drawText(sheet===1?'PLANTA BAJA':'PLANTA ALTA',{x:640,y:552,font:bold,size:15,color:teal});
  const rooms=[{x:100,y:140,w:280,h:150,label:'AREA A'},{x:100,y:300,w:280,h:160,label:'AREA B'},{x:400,y:140,w:340,h:150,label:'AREA C'},{x:400,y:300,w:340,h:160,label:rev===2?'AREA D - REVISADA':'AREA D'}];
  for(const r of rooms){p.drawRectangle({x:r.x,y:r.y,width:r.w,height:r.h,borderColor:teal,borderWidth:3,color:rgb(.95,.98,.97)});p.drawText(r.label,{x:r.x+25,y:r.y+r.h/2,font:bold,size:14,color:ink});}
  p.drawLine({start:{x:75,y:115},end:{x:765,y:115},color:muted,thickness:1});p.drawText('24.00 m - ESQUEMA ILUSTRATIVO',{x:330,y:96,font,size:10,color:muted});
  p.drawText('N',{x:802,y:455,font:bold,size:16,color:ink});p.drawLine({start:{x:807,y:400},end:{x:807,y:445},color:ink,thickness:2});
 }
 await writeFile(new URL('./plano-demo-v'+rev+'.pdf',import.meta.url),await doc.save());
}
