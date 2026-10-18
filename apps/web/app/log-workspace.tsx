'use client';
import {useCan} from './access';
import {useEffect,useRef,useState} from 'react';
import {Camera,Mic,Square,Upload,FileText,Check,Plus,LoaderCircle,LockKeyhole} from 'lucide-react';
import type {Log,LogAttachment} from './types';
const time=(d:string)=>new Date(d).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Mexico_City'});
const fileLimit=8*1024*1024;
type Save=(path:string,body:unknown,message:string)=>Promise<boolean>;
function Recorder({onFile,onBusy,disabled}:{onFile:(file:File)=>void;onBusy:(value:boolean)=>void;disabled:boolean}){
 const [recording,setRecording]=useState(false),[seconds,setSeconds]=useState(0),[error,setError]=useState('');
 const recorder=useRef<MediaRecorder|null>(null),stream=useRef<MediaStream|null>(null),timer=useRef<ReturnType<typeof setInterval>|null>(null),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;if(timer.current)clearInterval(timer.current);if(recorder.current?.state==='recording')recorder.current.stop();stream.current?.getTracks().forEach(t=>t.stop());};},[]);
 async function start(){
  setError('');onBusy(true);
  try{
   if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined')throw new Error('Este navegador no permite grabar. Puedes adjuntar un archivo de audio.');
   const media=await navigator.mediaDevices.getUserMedia({audio:true});
   if(!alive.current){media.getTracks().forEach(t=>t.stop());return;}
   stream.current=media;
   const mime=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(m=>MediaRecorder.isTypeSupported(m));
   const rec=new MediaRecorder(media,mime?{mimeType:mime}:undefined);recorder.current=rec;
   let chunks:Blob[]=[],bytes=0;setSeconds(0);setRecording(true);
   rec.ondataavailable=e=>{if(e.data.size){chunks.push(e.data);bytes+=e.data.size;if(bytes>fileLimit&&rec.state==='recording')rec.stop();}};
   rec.onstop=()=>{media.getTracks().forEach(t=>t.stop());if(timer.current)clearInterval(timer.current);if(!alive.current)return;setRecording(false);onBusy(false);if(bytes>fileLimit){setError('La grabación superó 8 MB. Graba una nota más corta.');return;}const type=rec.mimeType.split(';')[0];const ext=type==='audio/mp4'?'m4a':type==='audio/ogg'?'ogg':'webm';onFile(new File(chunks,`Nota-de-voz-${Date.now()}.${ext}`,{type}));};
   rec.onerror=()=>{setError('Se interrumpió la grabación. Revisa el audio antes de guardarlo.');if(rec.state==='recording')rec.stop();else{media.getTracks().forEach(t=>t.stop());if(timer.current)clearInterval(timer.current);setRecording(false);onBusy(false);}};
   rec.start(1000);const started=Date.now();timer.current=setInterval(()=>{const elapsed=Math.floor((Date.now()-started)/1000);setSeconds(elapsed);if(elapsed>=300&&rec.state==='recording')rec.stop();},500);
  }catch(e){stream.current?.getTracks().forEach(t=>t.stop());if(alive.current){setRecording(false);onBusy(false);setError((e as Error).name==='NotAllowedError'?'No se autorizó el micrófono. Puedes permitirlo o adjuntar un audio.':(e as Error).message);}}
 }
 return <div className="voice-control">{recording?<button type="button" className="secondary recording" onClick={()=>recorder.current?.stop()}><Square size={15}/>Detener · {Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}</button>:<button type="button" className="secondary" disabled={disabled} onClick={start}><Mic size={16}/>Grabar voz</button>}<span>Máximo 5 minutos · se guarda solo al confirmar</span>{error&&<p role="alert" className="error">{error}</p>}</div>;
}
function Preview({file}:{file:File}){
 const [url,setUrl]=useState('');useEffect(()=>{const u=URL.createObjectURL(file);setUrl(u);return()=>URL.revokeObjectURL(u);},[file]);
 return file.type.startsWith('image/')?<img className="pending-image" src={url||undefined} alt="Vista previa de evidencia"/>:<audio controls src={url||undefined} preload="metadata"/>;
}
function Evidence({attachment:a,logId,busy,transcription,save,review,canWrite}:{attachment:LogAttachment;logId:string;busy:boolean;transcription:boolean;save:Save;review:(a:LogAttachment)=>void;canWrite:boolean}){
 const [consent,setConsent]=useState(false);
 const url=`/api/logs/${logId}/attachments/${a.id}`;
 return <article className="evidence-card">
  {a.mime.startsWith('image/')?<a href={url} target="_blank" rel="noreferrer"><img src={url} alt={a.caption} loading="lazy"/></a>:<audio controls src={url} preload="none"/>}
  <strong>{a.caption}</strong><p>{a.name} · {(a.size/1024/1024).toFixed(2)} MB</p><small>{a.author} · {time(a.createdAt)}</small>
  <a className="text-button" href={url} target="_blank" rel="noreferrer">Abrir original</a>
  {a.mime.startsWith('audio/')&&<>{a.transcript?<div className="transcript-preview"><span>Transcripción automática · revisar</span><p className="preserve">{a.transcript}</p>{a.publishedAddendum?<small>Incorporada como adenda revisada.</small>:<button className="text-button" disabled={busy||!canWrite} onClick={()=>review(a)}>Revisar e incorporar como adenda</button>}</div>:<div className="transcription-action">{transcription&&canWrite?<><label className="history-toggle"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} disabled={busy}/>Enviar este audio a OpenAI para transcribirlo</label><button className="secondary" disabled={busy||!consent} onClick={()=>save(`logs/${logId}/attachments/${a.id}/transcribe`,{sendToOpenAI:true},'Transcripción preparada; revísala antes de incorporarla')}><FileText size={15}/>{a.transcriptionStatus==='PROCESSING'?'Consultar / reintentar':'Transcribir audio'}</button>{a.transcriptionStatus==='ERROR'&&<small>No se completó la transcripción. El audio se conserva.</small>}</>:<p>{canWrite?'Transcripción pendiente de configurar. Puedes escuchar la grabación.':'Audio conservado en una obra cerrada.'}</p>}</div>}</>}
 </article>;
}
export function LogWorkspace({log,busy,error,save,setBusy,transcription}:{log:Log;busy:boolean;error:string;save:Save;setBusy:(value:boolean)=>void;transcription:boolean}){
 const [file,setFile]=useState<File|null>(null),[caption,setCaption]=useState(''),[addendumId,setAddendumId]=useState(''),[note,setNote]=useState(''),[source,setSource]=useState<string|undefined>(),[localError,setLocalError]=useState('');
 const input=useRef<HTMLInputElement>(null),noteInput=useRef<HTMLTextAreaElement>(null);
 const can=useCan();const canWrite=can('logs')&&log.project.status==='ACTIVE';const targetRequired=log.status==='CLOSED';
 function choose(f:File){setLocalError('');if(f.size===0||f.size>fileLimit){setLocalError('Selecciona un archivo entre 1 byte y 8 MB.');return;}setFile(f);setCaption('');}
 async function upload(){if(!file)return;setLocalError('');setBusy(true);try{const encoded=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('No se pudo leer el archivo'));reader.readAsDataURL(file);});let mime=file.type.split(';')[0];if(mime==='audio/x-wav')mime='audio/wav';if(mime==='audio/x-m4a')mime='audio/mp4';const okay=await save(`logs/${log.id}/attachments`,{base64:encoded,name:file.name,mime,caption,addendumId:addendumId||undefined},'Evidencia guardada');if(okay){setFile(null);setCaption('');if(input.current)input.current.value='';}}catch(e){setLocalError((e as Error).message);}finally{setBusy(false);}}
 function review(a:LogAttachment){setNote(a.transcript||'');setSource(a.id);noteInput.current?.focus();noteInput.current?.scrollIntoView({block:'center',behavior:'smooth'});}
 const evidence=(files:LogAttachment[])=>files.length?<div className="evidence-grid">{files.map(a=><Evidence key={a.id} attachment={a} logId={log.id} busy={busy} canWrite={canWrite} transcription={transcription} save={save} review={review}/>)}</div>:<p className="small-note">Sin archivos adjuntos en este registro.</p>;
 return <><span className="eyebrow">BITÁCORA / {log.project.code}</span><h2>{log.title}</h2><p className="dialog-sub">{log.project.name} · {log.date.slice(0,10)} · {log.author}</p>
  <div className="log-facts"><span>{log.status==='CLOSED'?'Registro cerrado':'Borrador'}</span><span>{log.crew} personas</span><span>{log.weather}</span></div>
  {(log.front||log.budgetItem)&&<div className="detail-box"><strong>{log.front||'Sin frente indicado'}</strong>{log.budgetItem&&<p>{log.budgetItem.code} · {log.budgetItem.name}</p>}</div>}
  <h3 className="detail-label">Actividades originales</h3><p className="preserve">{log.activities}</p>{log.incident&&<><h3 className="detail-label">Incidencias originales</h3><p className="incident preserve">{log.incident}</p></>}
  <section className="log-section"><h3><Camera size={17}/>Evidencia del registro original</h3>{evidence(log.attachments.filter(a=>!a.addendumId))}</section>
  <section className="log-section"><h3>Adendas y aclaraciones <span className="count">{log.addenda.length}</span></h3>{!log.addenda.length&&<p className="small-note">Las aclaraciones conservan el registro original y su autoría.</p>}{log.addenda.map(n=><article className="addendum" key={n.id}><small>{n.author} · {time(n.createdAt)}{n.sourceAttachmentId?' · Audio revisado':''}</small><p className="preserve">{n.text}</p>{evidence(log.attachments.filter(a=>a.addendumId===n.id))}</article>)}</section>
  {canWrite&&<>
   <form className="log-section" onSubmit={async e=>{e.preventDefault();if(await save(`logs/${log.id}/addenda`,{text:note,sourceAttachmentId:source},'Adenda guardada')){setNote('');setSource(undefined);}}}><h3><Plus size={17}/>{source?'Revisar transcripción':'Añadir aclaración'}</h3><p className="small-note">{source?'Corrige nombres, cantidades y unidades. Solo el texto que confirmes se incorporará como adenda.':'La adenda se conserva con autor y fecha; corrige errores mediante una nueva aclaración.'}</p><label className="field"><span>Texto de la adenda</span><textarea ref={noteInput} value={note} onChange={e=>setNote(e.target.value)} required rows={4} maxLength={10000} disabled={busy}/></label><div className="log-actions">{source&&<button type="button" className="secondary" disabled={busy} onClick={()=>{setSource(undefined);setNote('');}}>Descartar revisión</button>}<button className="primary" disabled={busy||!note.trim()}><Check size={15}/>Guardar adenda revisada</button></div></form>
   <section className="log-section"><h3><Upload size={17}/>Agregar fotos o audio</h3><p className="small-note">JPG, PNG, WebP · audio WebM, OGG, WAV, MP3 o M4A. Hasta 8 MB por archivo; 20 archivos y 40 MB por bitácora.</p>
    <label className="field"><span>Asociar evidencia a</span><select value={addendumId} onChange={e=>setAddendumId(e.target.value)} disabled={busy}>{!targetRequired&&<option value="">Registro original (borrador)</option>}{targetRequired&&<option value="">Selecciona una adenda</option>}{log.addenda.map((n,i)=><option key={n.id} value={n.id}>Adenda {i+1} · {n.text.slice(0,60)}</option>)}</select></label>
    {targetRequired&&!log.addenda.length&&<p className="small-note">Crea una adenda arriba para adjuntar evidencia a esta bitácora cerrada.</p>}
    <div className="log-actions"><label className={'secondary file-picker '+(busy?'disabled':'')}><Camera size={16}/>Elegir foto o audio<input ref={input} type="file" accept="image/jpeg,image/png,image/webp,audio/webm,audio/ogg,audio/wav,audio/x-wav,audio/mpeg,audio/mp4,audio/x-m4a,.m4a" disabled={busy||(targetRequired&&!addendumId)} onChange={e=>{const f=e.target.files?.[0];if(f)choose(f);}}/></label><Recorder onFile={choose} onBusy={setBusy} disabled={busy||(targetRequired&&!addendumId)}/></div>
    {file&&<div className="pending-evidence"><strong>Pendiente de guardar · {file.name}</strong><Preview file={file}/><label className="field"><span>Descripción de la evidencia</span><input value={caption} onChange={e=>setCaption(e.target.value)} maxLength={200} disabled={busy} placeholder="Ej. Colado de losa, frente A"/></label><div className="log-actions"><button className="secondary" disabled={busy} onClick={()=>{setFile(null);if(input.current)input.current.value='';}}>Descartar archivo</button><button className="primary" disabled={busy||!caption.trim()||(targetRequired&&!addendumId)} onClick={upload}>{busy?<LoaderCircle size={15} className="spin"/>:<Upload size={15}/>}Guardar evidencia</button></div></div>}
   </section>
  </>}
  {(error||localError)&&<div role="alert" className="error">{error||localError}</div>}
  {canWrite&&log.status==='DRAFT'&&<div className="log-section"><p className="small-note">Al cerrar, el texto y la evidencia original quedan fijos. Podrás añadir aclaraciones mediante adendas.</p><button className="secondary" disabled={busy||Boolean(file)} onClick={()=>save(`logs/${log.id}/close`,{},'Bitácora cerrada; las nuevas aclaraciones serán adendas')}><LockKeyhole size={15}/>Cerrar bitácora</button>{file&&<p className="small-note">Guarda o descarta el archivo pendiente antes de cerrar.</p>}</div>}
 </>;
}
