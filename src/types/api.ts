import type { PenmaDocument } from './document';

export interface FetchUrlRequest {
  url: string;
  viewport?: { width: number; height: number };
}

export interface FetchUrlResponse {
  success: boolean;
  document?: PenmaDocument;
  error?: string;
}

export interface ExportRequest {
  document: PenmaDocument;
  format: 'html' | 'zip';
}

export interface ExportResponse {
  success: boolean;
  html?: string;
  css?: string;
  error?: string;
}
