/**
 * Editor configuration — centralized feature flags for editing capabilities.
 *
 * Import: import { editorConfig } from '@/configs/editor'
 *
 * These are the default values. Runtime state is managed in the Zustand store
 * (ui-slice), but initial values are sourced from here.
 */

export interface EditorConfig {
  /** Master switch — when false, all editing is disabled */
  enabled: boolean;

  /** Allow double-click to edit text content inline */
  textEditable: boolean;

  /** Allow dragging resize handles to resize elements */
  resizable: boolean;

  /** Allow dragging elements to reposition them */
  movable: boolean;
}

/**
 * Default editor configuration.
 * Change these to set the initial state when the app loads.
 */
export const editorConfig: EditorConfig = {
  enabled: true,
  textEditable: true,
  resizable: true,
  movable: true,
};

export const sidebarConfig = {
  showNativeCss: false,
};

/**
 * Import blacklist — file/folder names to skip when importing from ZIP.
 * Paths containing any of these names (case-insensitive) are excluded.
 */
export const importBlacklist: string[] = [
  '__MACOSX',
  '.DS_Store',
  'Thumbs.db',
  '.git',
  'node_modules',
  '.svn',
  '.hg',
];