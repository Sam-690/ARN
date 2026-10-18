import { Prisma } from '@prisma/client';
export const D = (n: Prisma.Decimal.Value) => new Prisma.Decimal(n);
export const roundMoney = (n: Prisma.Decimal) => n.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
export function lineTotal(quantity: Prisma.Decimal.Value, price: Prisma.Decimal.Value) { return roundMoney(D(quantity).mul(price)); }
export function averageCost(oldQty: Prisma.Decimal.Value, oldCost: Prisma.Decimal.Value, newQty: Prisma.Decimal.Value, newCost: Prisma.Decimal.Value) {
 return D(oldQty).mul(oldCost).add(D(newQty).mul(newCost)).div(D(oldQty).add(newQty)).toDecimalPlaces(4);
}
export function moneySummary(order: {lines: {quantity:Prisma.Decimal.Value; received:Prisma.Decimal.Value; unitPrice:Prisma.Decimal.Value}[]; payments:{amount:Prisma.Decimal.Value}[]}) {
 const total = order.lines.reduce((s,l)=>s.add(lineTotal(l.quantity,l.unitPrice)),D(0));
 const received = order.lines.reduce((s,l)=>s.add(lineTotal(l.received,l.unitPrice)),D(0));
 const paid = order.payments.reduce((s,p)=>s.add(p.amount),D(0));
 return {total:total.toFixed(2),received:received.toFixed(2),paid:paid.toFixed(2),due:received.sub(paid).toFixed(2),committed:total.sub(received).toFixed(2)};
}
