import { canDo } from '../access';
import { nav, type Page } from './navigation';

export type WorkspaceLocation = { page: Page; projectId: string };
type WorkspaceAccess = {
  user: { id: string; permissions: string[] };
  projects: { id: string }[];
};

const directory: WorkspaceLocation = { page: 'projects', projectId: 'all' };
const storageKey = (userId: string) => `obra:workspace:v1:${userId}`;

export function validateWorkspaceLocation(
  value: unknown,
  access: WorkspaceAccess,
): WorkspaceLocation {
  if (!value || typeof value !== 'object') return directory;
  const { page, projectId } = value as Record<string, unknown>;
  if (page === 'company' || page === 'team') {
    const scope =
      typeof projectId === 'string' && access.projects.some((p) => p.id === projectId)
        ? projectId
        : 'all';
    return {
      page: page === 'team' && !canDo(access.user.permissions, 'users') ? 'company' : page,
      projectId: scope,
    };
  }
  if (page === 'projects' || projectId === 'all') return directory;
  if (typeof projectId !== 'string' || !access.projects.some((p) => p.id === projectId))
    return directory;
  const validPage = nav.some(([key]) => key === page);
  if (!validPage) return { page: 'dashboard', projectId };
  return { page: page as Page, projectId };
}

export function restoreWorkspaceLocation(access: WorkspaceAccess): WorkspaceLocation {
  try {
    const saved = window.localStorage.getItem(storageKey(access.user.id));
    return validateWorkspaceLocation(saved ? JSON.parse(saved) : null, access);
  } catch {
    // El almacenamiento puede estar bloqueado o contener un valor de una versión anterior.
    return directory;
  }
}

export function saveWorkspaceLocation(userId: string, location: WorkspaceLocation) {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(location));
  } catch {
    // La navegación sigue funcionando aunque el navegador no permita guardar preferencias.
  }
}
