'use client';
import { createContext, useContext } from 'react';
export const AccessContext = createContext<string[]>([]);
export function useCan() {
  const permissions = useContext(AccessContext);
  return (permission: string) => permissions.includes('*') || permissions.includes(permission);
}
export function canDo(permissions: string[] | undefined, permission: string) {
  return !!permissions && (permissions.includes('*') || permissions.includes(permission));
}
export function permissionFor(path: string, body: any = {}) {
  if (path === 'auth/password') return null;
  if (path.startsWith('users')) return 'users';
  if (path === 'projects' || /^projects\/[^/]+\/close$/.test(path)) return 'projects';
  if (path.endsWith('/approve-budget')) return 'approveBudget';
  if (path === 'materials') return 'materials';
  if (path === 'budget') return 'budget';
  if (path === 'orders' || /^orders\/[^/]+\/cancel$/.test(path)) return 'orders';
  if (/^orders\/[^/]+\/approve$/.test(path)) return 'approveOrder';
  if (/^orders\/[^/]+\/pay$/.test(path)) return 'payments';
  if (path.startsWith('stock/') || /^orders\/[^/]+\/receive$/.test(path)) return 'stock';
  if (path.startsWith('supply/')) return 'supply';
  if (path.startsWith('logs')) return 'logs';
  if (path.startsWith('drawings') || path.startsWith('plan-issues')) return 'plans';
  if (path.startsWith('documents')) return 'documents';
  if (path.startsWith('changes'))
    return body.action === 'SETTLEMENT'
      ? 'payments'
      : ['APPROVE', 'REJECT'].includes(body.action)
        ? 'approveChange'
        : 'changes';
  if (path === 'experience/families') return 'families';
  if (path.startsWith('experience/'))
    return path.endsWith('/actions') ? 'validateExperience' : 'experience';
  return 'unavailable';
}
