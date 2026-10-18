import {cp,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
const require=createRequire(import.meta.url);
const source=dirname(require.resolve('pdfjs-dist/package.json'));
const dest=resolve(import.meta.dirname,'../apps/web/public/pdfjs');
await mkdir(dest,{recursive:true});
for(const item of ['build/pdf.worker.min.mjs','cmaps','standard_fonts','wasm']){
 await cp(resolve(source,item),resolve(dest,item.startsWith('build/')?'pdf.worker.min.mjs':item),{recursive:true});
}
