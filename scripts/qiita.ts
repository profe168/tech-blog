import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { PLATFORMS_DIR, SOURCE_DIR, cleanupRemovedFiles, listFilesRecursive, parseSourceMetadata } from './shared.js';

/**
 * Qiita の記事メタデータ型
 */
export interface QiitaMetadata {
  id: string | null;
  title: string;
  tags: string[];
  private: boolean;
  updated_at: string;
  organization_url_name: string;
  slide: boolean;
  ignorePublish: boolean;
}

type ExistingQiitaMetadata = {
  [K in keyof Pick<
    QiitaMetadata,
    'id' | 'updated_at' | 'organization_url_name' | 'slide' | 'ignorePublish'
  >]?: unknown;
};

const QIITA_DIR = path.join(PLATFORMS_DIR, 'qiita');
const DEFAULT_QIITA_PRIVATE = true;
const QIITA_TAG_LIMIT = 5;
const DEFAULT_QIITA_IMAGE_BASE_URL = 'https://cdn.jsdelivr.net/gh/profe168/tech-blog@master/source';

export interface QiitaConvertOptions {
  sourceArticlesDir?: string;
  qiitaPublicDir?: string;
  imageBaseUrl?: string;
}

/**
 * 本文の変換 (Zenn 特有の記法を Qiita 向けに変換、CDN経由の画像URLへ置換)
 */
export function convertBodyForQiita(
  body: string,
  imageBaseUrl: string = process.env.QIITA_IMAGE_BASE_URL ?? DEFAULT_QIITA_IMAGE_BASE_URL
): string {
  // 1. :::message -> :::note info / :::message alert -> :::note warn
  let converted = body.replace(/:::message( alert)?\n([\s\S]*?)\n:::/g, (_match, alert, content) => {
    const type = alert ? 'warn' : 'info';
    return `:::note ${type}\n${content.trim()}\n:::`;
  });

  // 2. "/images/..." 絶対パス -> 固定の公開 URL に変換
  const normalizedImageBaseUrl = imageBaseUrl.replace(/\/$/, '');
  converted = converted.replace(/!\[(.*?)\]\((\/images\/.*?)\)/g, `![$1](${normalizedImageBaseUrl}$2)`);
  converted = converted.replace(/!\[(.*?)\]\((.*?)\s*=\d+x\d*\)/g, `![$1]($2)`);

  return converted;
}

function readExistingQiitaMetadata(qiitaFile: string): ExistingQiitaMetadata {
  if (!fs.existsSync(qiitaFile)) {
    return {};
  }

  return matter.read(qiitaFile).data;
}

function createQiitaMetadata(
  title: string,
  tags: string[],
  existingMetadata: ExistingQiitaMetadata
): QiitaMetadata {
  return {
    id: typeof existingMetadata.id === 'string' ? existingMetadata.id : null,
    title,
    tags: tags.slice(0, QIITA_TAG_LIMIT),
    private: DEFAULT_QIITA_PRIVATE,
    updated_at: typeof existingMetadata.updated_at === 'string' ? existingMetadata.updated_at : '',
    organization_url_name: typeof existingMetadata.organization_url_name === 'string'
      ? existingMetadata.organization_url_name
      : '',
    slide: typeof existingMetadata.slide === 'boolean' ? existingMetadata.slide : false,
    ignorePublish: typeof existingMetadata.ignorePublish === 'boolean' ? existingMetadata.ignorePublish : false
  };
}

/**
 * 単独の記事を Qiita 向けに変換・保存
 */
function syncQiitaArticle(
  sourceArticlesDir: string,
  qiitaPublicDir: string,
  sourceFile: string,
  imageBaseUrl?: string
) {
  const relativePath = path.relative(sourceArticlesDir, sourceFile);
  const qiitaFile = path.join(qiitaPublicDir, relativePath);

  const sourceContent = fs.readFileSync(sourceFile, 'utf8');
  const sourceParsed = matter(sourceContent);
  const metadata = (() => {
    try {
      return parseSourceMetadata(sourceParsed.data);
    } catch {
      throw new Error(`${relativePath} is missing required metadata: title, tags`);
    }
  })();

  const existingMetadata = readExistingQiitaMetadata(qiitaFile);
  const qiitaMetadata = createQiitaMetadata(metadata.title, metadata.tags, existingMetadata);
  const qiitaBody = convertBodyForQiita(sourceParsed.content, imageBaseUrl);

  fs.mkdirSync(path.dirname(qiitaFile), { recursive: true });
  const output = matter.stringify(qiitaBody, qiitaMetadata);
  fs.writeFileSync(qiitaFile, output, 'utf8');
}

/**
 * Qiita 向け記事の変換・出力処理
 */
export function convertToQiita(options: QiitaConvertOptions = {}) {
  const sourceArticlesDir = options.sourceArticlesDir ?? path.join(SOURCE_DIR, 'articles');
  const qiitaPublicDir = options.qiitaPublicDir ?? path.join(QIITA_DIR, 'public');

  cleanupRemovedFiles(sourceArticlesDir, qiitaPublicDir);

  const files = listFilesRecursive(sourceArticlesDir, file => file.endsWith('.md'));

  for (const file of files) {
    syncQiitaArticle(sourceArticlesDir, qiitaPublicDir, file, options.imageBaseUrl);
  }
}
