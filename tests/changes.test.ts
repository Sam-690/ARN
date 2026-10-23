import test from 'node:test';
import assert from 'node:assert/strict';
import { delta, changeStatus, changeBalance, projectChangeSummary } from '../apps/api/src/changes';
const p = {
  id: 'p',
  startDate: new Date('2026-10-01'),
  endDate: new Date('2026-10-31'),
  budgetItems: [{ quantity: '3', unitPrice: '0.335' }],
};
const change = {
  projectId: 'p',
  status: 'APPROVED',
  progress: 0,
  proposals: [{ number: 1, costDelta: '1.20', priceDelta: '-5.00', daysDelta: 2 }],
  settlements: [{ amount: '1.50' }],
};
test('cambios usan centavos exactos y separan costo directo del importe al cliente', () => {
  assert.equal(delta.parse('-1.20'), '-1.20');
  for (const value of ['1.234', '1e5', 'NaN', 'Infinity', '100000001', ''])
    assert.throws(() => delta.parse(value));
  const summary = projectChangeSummary(p, [
    change,
    { ...change, status: 'SUBMITTED' },
    { ...change, projectId: 'other' },
  ]);
  assert.equal(summary.baseBudget, '1.01');
  assert.equal(summary.approvedCostDelta, '1.20');
  assert.equal(summary.adjustedBudget, '2.21');
  assert.equal(summary.approvedPriceDelta, '-5.00');
  assert.equal(summary.adjustedEndDate.slice(0, 10), '2026-11-02');
  assert.equal(p.endDate.toISOString().slice(0, 10), '2026-10-31');
});
test('saldo comercial toma revisión vigente y reconoce créditos sin mezclar costos', () => {
  const result = changeBalance({
    ...change,
    proposals: [
      ...change.proposals,
      { number: 2, costDelta: '100', priceDelta: '-8.25', daysDelta: 0 },
    ],
  });
  assert.equal(result.settlementKind, 'CREDIT');
  assert.equal(result.applied, '1.50');
  assert.equal(result.outstanding, '6.75');
  assert.equal(changeBalance({ ...change, status: 'SUBMITTED' }).outstanding, '0.00');
});
test('aprobación fija la propuesta y las transiciones invalidas se rechazan', () => {
  assert.equal(changeStatus('DRAFT', 'SUBMIT'), 'SUBMITTED');
  assert.equal(changeStatus('SUBMITTED', 'REJECT'), 'REJECTED');
  assert.equal(changeStatus('REJECTED', 'REVISE'), 'DRAFT');
  assert.equal(changeStatus('SUBMITTED', 'APPROVE'), 'APPROVED');
  for (const action of ['REVISE', 'CANCEL', 'APPROVE', 'REJECT'])
    assert.throws(() => changeStatus('APPROVED', action));
  assert.throws(() => changeStatus('DRAFT', 'SETTLEMENT'));
  assert.throws(() => changeStatus('CANCELLED', 'PROGRESS'));
});
