import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 元記事（ソース）のメタデータ型
 */
export interface SourceMetadata {
  title: string;
  tags: [string, ...string[]];
}

// 共通パスの定義
export const ROOT_DIR = fileURLToPath(new URL('..', import.meta.url));
export const SOURCE_DIR = path.join(ROOT_DIR, 'source');
export const PLATFORMS_DIR = path.join(ROOT_DIR, 'platforms');

/**
 * source 記事のメタデータを検証して返す
 */
export function parseSourceMetadata(data: unknown): SourceMetadata {
  if (typeof data !== 'object' || data === null) {
    throw new Error('required metadata: title, tags');
  }

  const { title, tags } = data as { title?: unknown; tags?: unknown };
  if (
    typeof title !== 'string'
    || !Array.isArray(tags)
    || tags.length === 0
    || !tags.every(tag => typeof tag === 'string')
  ) {
    throw new Error('required metadata: title, tags');
  }

  return { title, tags: tags as [string, ...string[]] };
}

/**
 * ディレクトリ配下のファイルを再帰的に列挙する
 */
export function listFilesRecursive(
  dir: string,
  predicate: (filePath: string) => boolean = () => true
): string[] {
  if (!fs.existsSync(dir)) return [];

  const files: string[] = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(entryPath, predicate));
      continue;
    }

    if (entry.isFile() && predicate(entryPath)) {
      files.push(entryPath);
    }
  }

  return files;
}

/**
 * source から消えたファイル・画像を target から削除し、同期ズレを防ぐ
 */
export function cleanupRemovedFiles(sourceDir: string, targetDir: string) {
  if (!fs.existsSync(sourceDir) || !fs.existsSync(targetDir)) return;

  for (const entry of fs.readdirSync(targetDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (!fs.existsSync(sourcePath)) {
      fs.rmSync(targetPath, { recursive: true, force: true });
      continue;
    }

    if (entry.isDirectory()) {
      if (!fs.statSync(sourcePath).isDirectory()) {
        fs.rmSync(targetPath, { recursive: true, force: true });
        continue;
      }

      cleanupRemovedFiles(sourcePath, targetPath);

      if (fs.readdirSync(targetPath).length === 0 && fs.readdirSync(sourcePath).length === 0) {
        continue;
      }
    } else if (!fs.statSync(sourcePath).isFile()) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    }
  }
}
