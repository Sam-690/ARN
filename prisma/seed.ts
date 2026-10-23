import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../apps/api/src/security';
const db = new PrismaClient();
async function main() {
  const email = process.env.SEED_ADMIN_EMAIL,
    password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password)
    throw new Error('Configura SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD en .env');
  await db.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: 'Administrador',
      role: 'ADMIN',
      mustChangePassword: false,
      passwordHash: hashPassword(password),
    },
  });
  if (await db.project.count()) {
    console.log('Datos existentes conservados.');
    return;
  }
  await db.$transaction(async (tx) => {
    const projects = await Promise.all(
      [
        {
          code: 'OB-001',
          name: 'Residencial Los Olivos',
          client: 'Grupo Inmobiliario del Centro',
          location: 'Querétaro, Qro.',
          manager: 'Andrea Mendoza',
          startDate: new Date('2026-09-01'),
          endDate: new Date('2027-04-30'),
          budgetApproved: true,
        },
        {
          code: 'OB-002',
          name: 'Nave Industrial Norte',
          client: 'Logística del Bajío',
          location: 'El Marqués, Qro.',
          manager: 'Ricardo Salas',
          startDate: new Date('2026-09-15'),
          endDate: new Date('2027-06-30'),
          budgetApproved: true,
        },
        {
          code: 'OB-003',
          name: 'Remodelación Casa Roble',
          client: 'Familia Robles',
          location: 'Corregidora, Qro.',
          manager: 'Lucía Torres',
          startDate: new Date('2026-10-05'),
          endDate: new Date('2026-12-20'),
          budgetApproved: false,
        },
      ].map((data) => tx.project.create({ data })),
    );
    const materials = await Promise.all(
      [
        {
          code: 'MAT-001',
          name: 'Cemento gris CPC 30R',
          unit: 'bulto',
          price: 225,
          type: 'MATERIAL',
        },
        {
          code: 'MAT-002',
          name: 'Varilla corrugada 3/8”',
          unit: 't',
          price: 21800,
          type: 'MATERIAL',
        },
        { code: 'MAT-003', name: 'Arena de río', unit: 'm³', price: 480, type: 'MATERIAL' },
        {
          code: 'MAT-004',
          name: 'Block de concreto 15 × 20 × 40',
          unit: 'pza',
          price: 16.5,
          type: 'MATERIAL',
        },
        { code: 'MAT-005', name: 'Grava triturada 3/4”', unit: 'm³', price: 590, type: 'MATERIAL' },
        {
          code: 'MO-001',
          name: 'Cuadrilla de albañilería',
          unit: 'jor',
          price: 1450,
          type: 'LABOR',
        },
        {
          code: 'EQ-001',
          name: 'Revolvedora de concreto',
          unit: 'día',
          price: 650,
          type: 'EQUIPMENT',
        },
      ].map((data) => tx.material.create({ data })),
    );
    const lines = [
      [
        {
          code: 'CIM-01',
          name: 'Cimentación y estructura',
          unit: 'm³',
          quantity: 380,
          unitPrice: 4200,
        },
        {
          code: 'ALB-01',
          name: 'Muros de mampostería',
          unit: 'm²',
          quantity: 1650,
          unitPrice: 780,
        },
        { code: 'ACA-01', name: 'Acabados interiores', unit: 'm²', quantity: 2100, unitPrice: 620 },
      ],
      [
        { code: 'EST-01', name: 'Estructura de nave', unit: 't', quantity: 96, unitPrice: 38500 },
        {
          code: 'PIS-01',
          name: 'Piso de concreto industrial',
          unit: 'm²',
          quantity: 3800,
          unitPrice: 940,
        },
      ],
      [
        {
          code: 'DEM-01',
          name: 'Demoliciones y retiro',
          unit: 'm²',
          quantity: 120,
          unitPrice: 280,
        },
        { code: 'ACA-01', name: 'Acabados y pintura', unit: 'm²', quantity: 310, unitPrice: 460 },
      ],
    ];
    for (let i = 0; i < projects.length; i++)
      for (const l of lines[i])
        await tx.budgetItem.create({
          data: {
            ...l,
            projectId: projects[i].id,
            components: [
              { name: 'Costo directo de referencia (demo)', quantity: 1, price: l.unitPrice },
            ],
          },
        });
    const specs = [
      {
        p: 0,
        m: 0,
        s: 'Materiales La Estación',
        q: 500,
        r: 300,
        used: 180,
        paid: 45000,
        status: 'PARTIAL',
      },
      { p: 1, m: 1, s: 'Aceros del Bajío', q: 8, r: 8, used: 3, paid: 87200, status: 'RECEIVED' },
      {
        p: 0,
        m: 3,
        s: 'Prefabricados del Centro',
        q: 2400,
        r: 0,
        used: 0,
        paid: 0,
        status: 'APPROVED',
      },
      { p: 2, m: 2, s: 'Agregados San José', q: 12, r: 0, used: 0, paid: 0, status: 'DRAFT' },
    ];
    for (const s of specs) {
      const m = materials[s.m],
        p = projects[s.p];
      const o = await tx.purchaseOrder.create({
        data: {
          projectId: p.id,
          supplier: s.s,
          expectedDate: new Date('2026-10-16'),
          status: s.status,
          lines: { create: { materialId: m.id, quantity: s.q, received: s.r, unitPrice: m.price } },
        },
      });
      if (s.r) {
        await tx.stock.create({
          data: { projectId: p.id, materialId: m.id, quantity: s.r - s.used, averageCost: m.price },
        });
        await tx.movement.create({
          data: {
            projectId: p.id,
            materialId: m.id,
            type: 'IN',
            quantity: s.r,
            unitCost: m.price,
            reference: `OC-${o.number} · Recepción de demostración`,
          },
        });
      }
      if (s.used)
        await tx.movement.create({
          data: {
            projectId: p.id,
            materialId: m.id,
            type: 'OUT',
            quantity: s.used,
            unitCost: m.price,
            reference: 'Consumo inicial de demostración',
          },
        });
      if (s.paid)
        await tx.payment.create({
          data: {
            orderId: o.id,
            amount: s.paid,
            reference: `DEMO-${o.number}`,
            method: 'Transferencia',
            paidAt: new Date('2026-10-09'),
          },
        });
    }
    await tx.siteLog.createMany({
      data: [
        {
          projectId: projects[0].id,
          date: new Date('2026-10-10'),
          title: 'Colado de losa · edificio A',
          activities:
            'Se concluyó el armado y colado de la losa del primer nivel. Se revisaron niveles y recubrimientos antes del vaciado.',
          incident: 'Confirmar la entrega del siguiente lote de cemento antes del martes.',
          crew: 18,
          weather: 'Despejado',
          author: 'Andrea Mendoza',
          status: 'CLOSED',
        },
        {
          projectId: projects[1].id,
          date: new Date('2026-10-10'),
          title: 'Montaje de estructura · eje 3',
          activities:
            'Montaje de columnas y vigas principales del eje 3. Se realizó revisión de torque y alineación.',
          incident: '',
          crew: 12,
          weather: 'Nublado',
          author: 'Ricardo Salas',
          status: 'DRAFT',
        },
        {
          projectId: projects[2].id,
          date: new Date('2026-10-09'),
          title: 'Inicio de trabajos preliminares',
          activities:
            'Protección de áreas existentes, trazo y preparación de la zona de demolición.',
          incident: '',
          crew: 5,
          weather: 'Despejado',
          author: 'Lucía Torres',
          status: 'DRAFT',
        },
      ],
    });
    await tx.audit.create({
      data: {
        actor: 'Sistema',
        action: 'Demostración preparada',
        entityId: projects[0].id,
        detail: 'Datos ficticios para explorar la primera versión.',
      },
    });
  });
  console.log('Demostración creada: 3 obras. Acceso según .env.');
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
