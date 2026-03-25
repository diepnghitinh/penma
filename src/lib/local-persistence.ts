/**
 * Local persistence layer using localStorage.
 * Acts as a safety net: saves are written here first before syncing to the database.
 * On load, if local data is newer than the database, the local version is restored.
 */

const STORAGE_PREFIX = 'penma:project:';

export interface LocalSave {
  pages: unknown[];
  projectName: string;
  savedAt: number; // Date.now() timestamp
}

export function saveProjectToLocal(projectId: string, data: LocalSave): void {
  try {
    // Strip large CSS data to avoid localStorage quota issues
    const json = JSON.stringify(data, (key, value) => {
      if (key === 'cssRules' || key === 'matchedCssRules' || key === 'cssClasses') return undefined;
      return value;
    });
    localStorage.setItem(`${STORAGE_PREFIX}${projectId}`, json);
  } catch {
    // Quota exceeded or localStorage unavailable — silently skip
  }
}

export function loadProjectFromLocal(projectId: string): LocalSave | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${projectId}`);
    if (!raw) return null;
    return JSON.parse(raw) as LocalSave;
  } catch {
    return null;
  }
}

export function clearProjectLocal(projectId: string): void {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${projectId}`);
  } catch {
    // ignore
  }
}
