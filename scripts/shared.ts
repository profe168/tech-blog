import path from 'path';
import fs from 'fs';

/**
 * 元記事（ソース）のメタデータ型
 */
export interface SourceMetadata {
  title: string;
  topics?: string[];
}

// 共通パスの定義
export const ROOT_DIR = path.resolve(__dirname, '..');
export const SOURCE_DIR = path.join(ROOT_DIR, 'source');
export const PLATFORMS_DIR = path.join(ROOT_DIR, 'platforms');

/**
 * source から消えたファイル・画像を target から削除し、同期ズレを防ぐ
 */
export function cleanupRemovedFiles(sourceDir: string, targetDir: string) {
  if (!fs.existsSync(sourceDir) || !fs.existsSync(targetDir)) return;

  const sourceFiles = fs.readdirSync(sourceDir);
  const targetFiles = fs.readdirSync(targetDir);

  for (const file of targetFiles) {
    if (!sourceFiles.includes(file)) {
      fs.rmSync(path.join(targetDir, file), { recursive: true, force: true });
    }
  }
}
