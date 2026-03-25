import { connectDB } from '@/lib/db/connection';
import { ImportedCss } from '@/lib/db/models/imported-css';
import type { ExtractedCssRule } from './scrape-page';

/**
 * Store extracted CSS rules in MongoDB for a given source URL.
 * Upserts — if CSS for this URL already exists, it gets replaced.
 */
export async function storeImportedCss(
  sourceUrl: string,
  rules: ExtractedCssRule[],
): Promise<void> {
  if (!rules || rules.length === 0) return;

  await connectDB();
  await ImportedCss.findOneAndUpdate(
    { sourceUrl },
    {
      sourceUrl,
      rules,
      ruleCount: rules.length,
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
