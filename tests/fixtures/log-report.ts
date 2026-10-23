import sharp from 'sharp';
import { ReportLog } from '../../apps/api/src/log-report';
export const reportProject = {
  code: 'MUESTRA-01',
  name: 'Ampliación de edificio administrativo',
  client: 'Cliente de ejemplo · documento de demostración',
  location: 'Ciudad de México',
  manager: 'Responsable de obra (ejemplo)',
};
export async function reportLogs(): Promise<ReportLog[]> {
  const svg = Buffer.from(
    `<svg width="1200" height="700" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="700" fill="#e9eeeb"/><path d="M0 570H1200V700H0Z" fill="#647f79"/><path d="M140 550V200H1050V550M140 330H1050M400 200V550M750 200V550" fill="none" stroke="#2e5956" stroke-width="25"/><text x="70" y="90" font-size="34" fill="#23433f">EVIDENCIA ILUSTRATIVA · MUESTRA FICTICIA</text><text x="70" y="650" font-size="25" fill="white">No corresponde a una fotografía de obra real</text></svg>`,
  );
  const content = await sharp(svg).png().toBuffer();
  const createdAt = new Date('2026-10-16T18:00:00Z');
  const paragraph =
    'Se realizó la revisión del armado y la colocación de elementos en el frente norte. Se verificaron niveles, separación del acero y limpieza del área antes de continuar. El residente coordinó los trabajos con el personal de campo y dejó registradas las observaciones para su seguimiento.';
  return [
    {
      id: 'registro-demostracion-01',
      title: 'Revisión de estructura y avance del frente norte',
      date: new Date('2026-10-16'),
      status: 'CLOSED',
      author: 'Residente de ejemplo',
      crew: 12,
      weather: 'Despejado',
      front: 'Edificio A / planta baja',
      budgetItem: { code: 'EST-01', name: 'Estructura de concreto armado' },
      activities:
        'Inicio del registro completo.\n\n' +
        Array.from({ length: 12 }, (_, i) => `${i + 1}. ${paragraph}`).join('\n\n') +
        '\nFin de las actividades completas.',
      incident:
        'Se detectó interferencia con una instalación existente. Se delimitó el área y se acordó revisar la solución con la supervisión antes de continuar en ese punto.\nEl resto de las actividades avanzó conforme al programa.',
      attachments: [
        {
          id: 'foto-01',
          name: 'evidencia-ilustrativa.png',
          mime: 'image/png',
          caption:
            'Vista general ilustrativa del frente de estructura. Imagen ficticia utilizada exclusivamente para mostrar el formato del expediente.',
          author: 'Residente de ejemplo',
          createdAt,
          addendumId: null,
          content,
        },
        {
          id: 'audio-01',
          name: 'nota-de-campo.webm',
          mime: 'audio/webm',
          caption: 'Nota de campo conservada como anexo digital',
          author: 'Residente de ejemplo',
          createdAt,
          addendumId: null,
        },
      ],
      addenda: [
        {
          id: 'adenda-01',
          text: 'Se revisó la interferencia descrita y se estableció la secuencia de trabajo para el siguiente turno. Esta aclaración complementa el registro original y conserva su fecha de incorporación.',
          author: 'Supervisor de ejemplo',
          createdAt: new Date('2026-10-17T16:30:00Z'),
        },
      ],
    },
  ];
}
