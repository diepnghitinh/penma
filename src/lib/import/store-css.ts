import { connectDB } from '@/lib/db/connection';
import { ImportedCss } from '@/lib/db/models/imported-css';
import type { ExtractedCssRule, ClassCssMap } from './scrape-page';

/**
 * Store extracted CSS rules and class CSS map in MongoDB for a given source URL.
 * Upserts — if CSS for this URL already exists, it gets replaced.
 */
export async function storeImportedCss(
  sourceUrl: string,
  rules: ExtractedCssRule[],
  classCss?: ClassCssMap,
): Promise<void> {
  if ((!rules || rules.length === 0) && (!classCss || Object.keys(classCss).length === 0)) return;

  await connectDB();
  await ImportedCss.findOneAndUpdate(
    { sourceUrl },
    {
      sourceUrl,
      rules: rules || [],
      ruleCount: rules?.length || 0,
      classCss: classCss || {},
    },
    { upsert: true, new: true },
  );
}

/**
 * Load stored CSS rules for a given source URL.
 */
export async function loadImportedCss(
  sourceUrl: string,
): Promise<ExtractedCssRule[]> {
  await connectDB();
  const doc = await ImportedCss.findOne({ sourceUrl }).lean();
  if (!doc) return [];
  return doc.rules as ExtractedCssRule[];
}

/**
 * Load stored class CSS map for a given source URL.
 */
export async function loadClassCss(
  sourceUrl: string,
): Promise<ClassCssMap> {
  await connectDB();
  const doc = await ImportedCss.findOne({ sourceUrl }).lean();
  if (!doc) return {};
  return (doc.classCss as ClassCssMap) || {};
}
