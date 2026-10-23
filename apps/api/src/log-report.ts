import { PDFDocument, PDFFont, PDFPage, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) => !isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s,
    'Fecha inválida',
  );
export const logExportSchema = z
  .object({
    projectId: z.string().min(1),
    from: date,
    to: date,
    includeDrafts: z.boolean().default(false),
    includePhotos: z.boolean().default(true),
    company: z.string().trim().max(120).default(''),
  })
  .refine((v) => v.to >= v.from, 'Revisa el periodo de exportación');
export type ReportPhoto = {
  id: string;
  name: string;
  mime: string;
  caption: string;
  author: string;
  createdAt: Date;
  addendumId: string | null;
  content?: Uint8Array;
};
export type ReportLog = {
  id: string;
  title: string;
  date: Date;
  status: string;
  author: string;
  crew: number;
  weather: string;
  front: string;
  activities: string;
  incident: string;
  budgetItem: { code: string; name: string } | null;
  attachments: ReportPhoto[];
  addenda: { id: string; text: string; author: string; createdAt: Date }[];
};
export type ReportProject = {
  code: string;
  name: string;
  client: string;
  location: string;
  manager: string;
};
const ink = rgb(0.12, 0.2, 0.23),
  accent = rgb(0.12, 0.39, 0.4),
  muted = rgb(0.39, 0.44, 0.46),
  line = rgb(0.82, 0.86, 0.85),
  pale = rgb(0.94, 0.96, 0.95);
const W = 595.28,
  H = 841.89,
  M = 48,
  CW = W - M * 2,
  BOTTOM = 64,
  TOP = H - 76;
const day = (d: Date) => d.toISOString().slice(0, 10);
const spanish = (d: Date) =>
  new Date(day(d) + 'T12:00:00Z').toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
const stamp = (d: Date) =>
  d.toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Mexico_City',
  });
let fontBytes: Promise<Buffer[]> | undefined;
export async function createLogReport(
  project: ReportProject,
  logs: ReportLog[],
  options: { company?: string; includePhotos: boolean; author: string; generatedAt?: Date },
) {
  if (!logs.length) throw new BadRequestException('No hay bitácoras en este periodo y estado.');
  if (logs.length > 30)
    throw new BadRequestException('Selecciona un periodo de hasta 30 bitácoras por expediente.');
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  fontBytes ??= Promise.all(
    ['DejaVuSans.ttf', 'DejaVuSans-Bold.ttf'].map((n) =>
      readFile(resolve(__dirname, '../assets/fonts', n)),
    ),
  );
  const [regular, bold] = await fontBytes;
  const font = await pdf.embedFont(regular, { subset: true }),
    strong = await pdf.embedFont(bold, { subset: true });
  const glyphs = new Set(font.getCharacterSet()),
    unsupported = new Set<string>();
  function clean(text: string) {
    return Array.from(text.normalize('NFC').replace(/\r\n?/g, '\n').replace(/\t/g, '    '))
      .map((c) => {
        if (c === '\n' || glyphs.has(c.codePointAt(0)!)) return c;
        unsupported.add(c);
        return `[U+${c.codePointAt(0)!.toString(16).toUpperCase()}]`;
      })
      .join('');
  }
  function wrap(text: string, size: number, width: number, f = font) {
    const out: string[] = [];
    for (const para of clean(text).split('\n')) {
      let current = '';
      for (const word of para.split(/\s+/).filter(Boolean)) {
        if (f.widthOfTextAtSize(current ? current + ' ' + word : word, size) <= width) {
          current = current ? current + ' ' + word : word;
          continue;
        }
        if (current) {
          out.push(current);
          current = '';
        }
        for (const char of word) {
          if (f.widthOfTextAtSize(current + char, size) > width) {
            out.push(current);
            current = '';
          }
          current += char;
        }
      }
      out.push(current);
    }
    return out;
  }
  let page!: PDFPage,
    y = TOP,
    context = 'EXPEDIENTE DE BITÁCORAS';
  const generated = options.generatedAt || new Date();
  const pages: PDFPage[] = [];
  function newPage(cover = false) {
    if (pdf.getPageCount() >= 400)
      throw new BadRequestException('El expediente excede 400 páginas. Reduce el periodo.');
    page = pdf.addPage([W, H]);
    pages.push(page);
    y = TOP;
    if (!cover) {
      page.drawText('OBRA / REGISTRO DE CAMPO', {
        x: M,
        y: H - 34,
        size: 8,
        font: strong,
        color: accent,
      });
      const label = wrap(project.code + ' · ' + context, 8, CW - 160)[0];
      page.drawText(label, { x: M + 160, y: H - 34, size: 8, font, color: muted });
      page.drawLine({
        start: { x: M, y: H - 45 },
        end: { x: W - M, y: H - 45 },
        color: line,
        thickness: 0.7,
      });
    }
  }
  function ensure(height: number) {
    if (y - height < BOTTOM) newPage();
  }
  function text(value: string, size = 10.5, f = font, color = ink, width = CW, x = M, space = 8) {
    const rows = wrap(value, size, width, f),
      leading = size * 1.5;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (i === 0 || rows[i - 1] === '') {
        let end = i;
        while (end < rows.length && rows[end] !== '') end++;
        const count = end - i;
        if (count <= 6) ensure(count * leading);
      }
      ensure((rows.length - i === 2 ? 2 : 1) * leading);
      if (row) page.drawText(row, { x, y: y - size, size, font: f, color });
      y -= leading;
    }
    y -= space;
  }
  function heading(label: string) {
    ensure(140);
    y -= 10;
    page.drawLine({
      start: { x: M, y: y + 5 },
      end: { x: W - M, y: y + 5 },
      color: line,
      thickness: 0.6,
    });
    text(label, 12, strong, accent, CW, M, 10);
  }
  function labelValue(label: string, value: string) {
    ensure(35);
    text(label.toUpperCase(), 7.5, strong, muted, CW, M, 2);
    text(value || 'No indicado', 10.5, font, ink, CW, M, 12);
  }
  function pill(value: string) {
    ensure(30);
    page.drawRectangle({ x: M, y: y - 22, width: CW, height: 24, color: pale });
    page.drawText(value, { x: M + 10, y: y - 14, size: 8.5, font: strong, color: accent });
    y -= 40;
  }
  const sorted = [...logs].sort(
    (a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id),
  );
  const pictures = logs.flatMap((l) => l.attachments).filter((a) => a.mime.startsWith('image/'));
  pdf.setTitle(`Expediente de bitácoras - ${project.name}`);
  pdf.setAuthor(options.company || options.author);
  pdf.setSubject(`Registro de campo de ${project.code}`);
  pdf.setCreator('Obra · Control de proyectos');
  pdf.setCreationDate(generated);
  pdf.setModificationDate(generated);
  newPage(true);
  page.drawRectangle({ x: 0, y: H - 18, width: W, height: 18, color: accent });
  y = H - 74;
  text(options.company || 'CONTROL Y SEGUIMIENTO DE OBRA', 10, strong, accent, CW, M, 28);
  text('Expediente\nde bitácoras', 34, strong, ink, CW, M, 22);
  text(project.name, 21, strong, accent, CW, M, 8);
  text(project.code + ' · ' + project.location, 10.5, font, muted, CW, M, 32);
  heading('Datos de entrega');
  labelValue('Cliente', project.client);
  labelValue('Responsable de obra', project.manager);
  labelValue('Periodo incluido', spanish(sorted[0].date) + ' al ' + spanish(sorted.at(-1)!.date));
  labelValue(
    'Contenido',
    `${logs.length} registro(s) · ${options.includePhotos ? pictures.length + ' fotografía(s)' : 'Fotografías excluidas por selección'} · ${logs.reduce((s, l) => s + l.addenda.length, 0)} adenda(s)`,
  );
  const drafts = logs.filter((l) => l.status !== 'CLOSED').length;
  text(
    drafts
      ? `COPIA DE REVISIÓN: incluye ${drafts} borrador(es), identificados en cada registro.`
      : 'Expediente de registros cerrados. Incluye las adendas disponibles a la fecha de emisión.',
    9,
    strong,
    drafts ? rgb(0.63, 0.26, 0.16) : accent,
  );
  text(
    `Emitido por ${options.author}\n${stamp(generated)} · hora de Ciudad de México`,
    8.5,
    font,
    muted,
  );
  text(
    'Los espacios de firma se completan al entregar. La exportación no representa por sí misma aceptación, autorización o firma del cliente.',
    8,
    font,
    muted,
  );
  // Index pages are reserved before content, then filled with exact page references.
  const entries = sorted.map((l, i) => ({
    log: l,
    number: i + 1,
    rows: wrap(l.title, 10, CW - 100, strong),
    page: 0,
  }));
  const indexSlots: { page: PDFPage; entries: typeof entries }[] = [];
  context = 'ÍNDICE';
  let slot: { page: PDFPage; entries: typeof entries } | null = null,
    used = 0;
  for (const entry of entries) {
    const height = entry.rows.length * 15 + 34;
    if (!slot || used + height > TOP - BOTTOM - 90) {
      newPage();
      slot = { page, entries: [] };
      indexSlots.push(slot);
      used = 0;
    }
    slot.entries.push(entry);
    used += height;
  }
  let photoCount = 0;
  async function photo(a: ReportPhoto) {
    photoCount++;
    const caption = `Fotografía ${String(photoCount).padStart(2, '0')} · ${a.caption}`;
    const metadata = `${a.name} · ${a.author} · ${stamp(a.createdAt)}`;
    if (!options.includePhotos) {
      ensure(100);
      text(caption, 10, strong);
      text('Imagen excluida por selección de exportación.', 9, font, muted);
      return;
    }
    if (!a.content)
      throw new BadRequestException(
        `No se encontró la imagen ${a.name}. El expediente no se generó incompleto.`,
      );
    let bytes: Buffer;
    try {
      bytes = await sharp(a.content, { limitInputPixels: 40_000_000, failOn: 'error' })
        .rotate()
        .resize({ width: 1800, height: 1400, fit: 'inside', withoutEnlargement: true })
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: 88 })
        .toBuffer();
    } catch {
      throw new BadRequestException(
        `No se pudo procesar la foto ${a.name}. Revisa su archivo original antes de exportar.`,
      );
    }
    const image = await pdf.embedJpg(bytes),
      scale = Math.min(CW / image.width, 252 / image.height),
      width = image.width * scale,
      height = image.height * scale;
    ensure(
      height +
        wrap(caption, 10, CW, strong).length * 15 +
        6 +
        7 +
        wrap(metadata, 7.5, CW).length * 11.25 +
        14,
    );
    text(caption, 10, strong, ink, CW, M, 6);
    page.drawRectangle({ x: M, y: y - height, width: CW, height, color: pale });
    page.drawImage(image, { x: M + (CW - width) / 2, y: y - height, width, height });
    y -= height + 7;
    text(metadata, 7.5, font, muted, CW, M, 14);
  }
  async function attachments(list: ReportPhoto[]) {
    if (!list.length) {
      text('Sin evidencia adjunta en este apartado.', 9, font, muted);
      return;
    }
    for (const a of list) {
      if (a.mime.startsWith('image/')) await photo(a);
      else {
        ensure(65);
        text('Anexo digital · ' + a.caption, 10, strong);
        text(
          `${a.name} · ${a.author} · ${stamp(a.createdAt)}\nAudio conservado en el sistema; no se reproduce en esta copia impresa.`,
          8.5,
          font,
          muted,
        );
      }
    }
  }
  for (const e of entries) {
    const l = e.log;
    context = `REGISTRO ${String(e.number).padStart(2, '0')} · ${day(l.date)}`;
    newPage();
    e.page = pdf.getPageCount();
    pill(
      `${spanish(l.date)} · ${l.status === 'CLOSED' ? 'REGISTRO CERRADO' : 'BORRADOR / PENDIENTE DE CIERRE'}`,
    );
    text(l.title, 22, strong, ink, CW, M, 16);
    labelValue('Registró', l.author);
    text(`Personal en obra: ${l.crew} personas  |  Clima: ${l.weather}`, 10, font, muted);
    if (l.front) labelValue('Frente de trabajo', l.front);
    if (l.budgetItem)
      labelValue('Concepto relacionado', l.budgetItem.code + ' · ' + l.budgetItem.name);
    heading('01 / Actividades realizadas');
    text(l.activities);
    heading('02 / Incidencias y observaciones');
    text(l.incident || 'Sin incidencias registradas.');
    if (
      options.includePhotos &&
      l.attachments.some((a) => !a.addendumId && a.mime.startsWith('image/'))
    )
      ensure(380);
    heading('03 / Evidencia del registro original');
    await attachments(l.attachments.filter((a) => !a.addendumId));
    if (l.addenda.length) {
      heading('04 / Adendas y aclaraciones');
      for (const [i, a] of l.addenda.entries()) {
        ensure(85);
        text(`Adenda ${i + 1} · ${stamp(a.createdAt)}`, 11, strong, accent);
        text('Registró: ' + a.author, 8.5, font, muted);
        text(a.text);
        const evidence = l.attachments.filter((p) => p.addendumId === a.id);
        if (evidence.length) await attachments(evidence);
      }
    }
    text('Referencia del registro: ' + l.id, 7.5, font, muted);
  }
  context = 'CONSTANCIA DE ENTREGA';
  newPage();
  text('Constancia de entrega', 24, strong, ink, CW, M, 20);
  text(project.name, 14, strong, accent);
  text(
    'Este espacio permite documentar la entrega física del expediente. Completar nombres, cargos, fecha y firmas al momento de recibirlo.',
    10.5,
  );
  for (const title of ['Elaboró / entregó', 'Recibió']) {
    heading(title);
    y -= 32;
    page.drawLine({ start: { x: M, y }, end: { x: M + CW, y }, color: line, thickness: 1 });
    y -= 10;
    text('Nombre y cargo', 8, font, muted);
    y -= 40;
    page.drawLine({ start: { x: M, y }, end: { x: M + CW, y }, color: line, thickness: 1 });
    y -= 10;
    text('Firma y fecha', 8, font, muted);
  }
  if (unsupported.size) {
    heading('Nota de reproducción');
    text(
      'Los caracteres sin glifo en la tipografía se conservan mediante su código Unicode: ' +
        [...unsupported]
          .map((c) => 'U+' + c.codePointAt(0)!.toString(16).toUpperCase())
          .join(', ') +
        '. El texto original permanece en el sistema.',
      8,
      font,
      muted,
    );
  }
  for (const s of indexSlots) {
    page = s.page;
    y = TOP;
    text('Contenido del expediente', 23, strong, ink, CW, M, 12);
    text(
      'Registros ordenados por fecha. La numeración incluye portada e índice.',
      9,
      font,
      muted,
      CW,
      M,
      20,
    );
    for (const e of s.entries) {
      const start = y;
      text(`${String(e.number).padStart(2, '0')}  ${e.log.title}`, 10, strong, ink, CW - 70, M, 3);
      text(
        `${spanish(e.log.date)} · ${e.log.status === 'CLOSED' ? 'Cerrado' : 'Borrador'}`,
        8.5,
        font,
        muted,
        CW - 70,
        M,
        14,
      );
      page.drawText(String(e.page), {
        x: W - M - 25,
        y: start - 10,
        size: 11,
        font: strong,
        color: accent,
      });
    }
  }
  const total = pdf.getPageCount();
  for (const [i, p] of pdf.getPages().entries()) {
    p.drawLine({ start: { x: M, y: 43 }, end: { x: W - M, y: 43 }, color: line, thickness: 0.6 });
    p.drawText(clean(project.code + ' · Expediente de bitácoras'), {
      x: M,
      y: 29,
      size: 8,
      font,
      color: muted,
    });
    p.drawText(`${i + 1} / ${total}`, { x: W - M - 45, y: 29, size: 8, font, color: muted });
  }
  return Buffer.from(await pdf.save());
}
