import path from 'path';
import fs from 'fs';
import { PLATFORMS_DIR, SOURCE_DIR, cleanupRemovedFiles } from './shared';

// 同期対象のフォルダ名
const SYNC_FOLDERS = ['articles', 'images'] as const;
const ZENN_DIR = path.join(PLATFORMS_DIR, 'zenn');

/**
 * 単独のフォルダを Zenn 向けに同期
 */
function syncZennFolder(folder: (typeof SYNC_FOLDERS)[number]) {
  const sourceDir = path.join(SOURCE_DIR, folder);
  const targetDir = path.join(ZENN_DIR, folder);

  if (!fs.existsSync(sourceDir)) return;
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  cleanupRemovedFiles(sourceDir, targetDir);

  const files = fs.readdirSync(sourceDir).filter(file => {
    if (folder === 'articles') return file.endsWith('.md');
    return fs.statSync(path.join(sourceDir, file)).isFile();
  });

  for (const file of files) {
    fs.copyFileSync(path.join(sourceDir, file), path.join(targetDir, file));
  }
}

/**
 * Zenn プラットフォームへの同期処理
 */
export function syncToZenn() {
  for (const folder of SYNC_FOLDERS) {
    syncZennFolder(folder);
  }
}
