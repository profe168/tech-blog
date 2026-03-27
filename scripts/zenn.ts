import fs from 'node:fs';
import path from 'node:path';
import { PLATFORMS_DIR, SOURCE_DIR, cleanupRemovedFiles, listFilesRecursive } from './shared.js';

// 同期対象のフォルダ名
const SYNC_FOLDERS = ['articles', 'images'] as const;
const ZENN_DIR = path.join(PLATFORMS_DIR, 'zenn');

export interface ZennSyncOptions {
  sourceRootDir?: string;
  zennDir?: string;
}

/**
 * 単独のフォルダを Zenn 向けに同期
 */
function syncZennFolder(
  folder: (typeof SYNC_FOLDERS)[number],
  sourceRootDir: string,
  zennDir: string
) {
  const sourceDir = path.join(sourceRootDir, folder);
  const targetDir = path.join(zennDir, folder);

  if (!fs.existsSync(sourceDir)) return;
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  cleanupRemovedFiles(sourceDir, targetDir);

  const files = listFilesRecursive(sourceDir, file => {
    if (folder === 'articles') return file.endsWith('.md');
    return true;
  });

  for (const file of files) {
    const relativePath = path.relative(sourceDir, file);
    const targetFile = path.join(targetDir, relativePath);
    fs.mkdirSync(path.dirname(targetFile), { recursive: true });
    fs.copyFileSync(file, targetFile);
  }
}

/**
 * Zenn プラットフォームへの同期処理
 */
export function syncToZenn(options: ZennSyncOptions = {}) {
  const sourceRootDir = options.sourceRootDir ?? SOURCE_DIR;
  const zennDir = options.zennDir ?? ZENN_DIR;

  for (const folder of SYNC_FOLDERS) {
    syncZennFolder(folder, sourceRootDir, zennDir);
  }
}
