import path from 'path';
import fs from 'fs';
import matter from 'gray-matter';
import { PLATFORMS_DIR, SOURCE_DIR, cleanupRemovedFiles, SourceMetadata } from './shared';

/**
 * Qiita の記事メタデータ型
 */
export interface QiitaMetadata {
  title: string;
  tags: string[];
  private: boolean;
  updated_at: string;
  id: string | null;
  organization_url_name: string | null;
  slide: boolean;
  ignorePublish: boolean;
}

const QIITA_DIR = path.join(PLATFORMS_DIR, 'qiita');
const DEFAULT_QIITA_PRIVATE = true;
const DEFAULT_QIITA_TAGS = ['zenn'];

/**
 * 読み込んだデータが正しいメタデータかを判定する型ガード
 */
function isValidMetadata(data: unknown): data is SourceMetadata {
  return typeof data === 'object'
    && data !== null
    && 'title' in data
    && typeof data.title === 'string';
}

/**
 * メタデータの変換 (Zenn -> Qiita)
 */
function buildQiitaMetadata(
  sourceData: SourceMetadata,
  currentQiitaId: string | null
): QiitaMetadata {
  const qiitaTags = Array.isArray(sourceData.topics)
    ? sourceData.topics.slice(0, 5)
    : DEFAULT_QIITA_TAGS;

  return {
    title: sourceData.title,
    tags: qiitaTags,
    private: DEFAULT_QIITA_PRIVATE,
    updated_at: '',
    id: currentQiitaId,
    organization_url_name: null,
    slide: false,
    ignorePublish: false
  };
}

/**
 * 本文の変換 (Zenn 特有の記法を Qiita 向けに変換、CDN経由の画像URLへ置換)
 */
export function convertBodyForQiita(body: string): string {
  // 1. :::message -> :::note info / :::message alert -> :::note warn
  let converted = body.replace(/:::message( alert)?\n([\s\S]*?)\n:::/g, (match, alert, content) => {
    const type = alert ? 'warn' : 'info';
    return `:::note ${type}\n${content.trim()}\n:::`;
  });

  // 2. "/images/..." 絶対パス -> jsDelivr経由のCDN URL
  const repo = process.env.GITHUB_REPOSITORY;
  const branch = process.env.GITHUB_REF_NAME;
  const qiitaImageBaseUrl = repo && branch
    ? `https://cdn.jsdelivr.net/gh/${repo}@${branch}/source`
    : null;

  if (qiitaImageBaseUrl) {
    converted = converted.replace(/!\[(.*?)\]\((\/images\/.*?)\)/g, `![$1](${qiitaImageBaseUrl}$2)`);
  }
  converted = converted.replace(/!\[(.*?)\]\((.*?)\s*=\d+x\d*\)/g, `![$1]($2)`);

  return converted;
}

/**
 * 単独の記事を Qiita 向けに変換・保存
 */
function syncQiitaArticle(sourceFile: string) {
  const filename = path.basename(sourceFile);
  const qiitaFile = path.join(QIITA_DIR, 'articles', filename);

  const sourceContent = fs.readFileSync(sourceFile, 'utf8');
  const sourceParsed = matter(sourceContent);

  const currentId: string | null = fs.existsSync(qiitaFile)
    ? matter(fs.readFileSync(qiitaFile, 'utf8')).data.id || null
    : null;

  if (!isValidMetadata(sourceParsed.data)) {
    throw new Error(`${filename} is missing required metadata: title`);
  }

  const qiitaMetadata = buildQiitaMetadata(sourceParsed.data, currentId);
  const qiitaBody = convertBodyForQiita(sourceParsed.content);

  const output = matter.stringify(qiitaBody, qiitaMetadata);
  fs.writeFileSync(qiitaFile, output, 'utf8');
}

/**
 * Qiita プラットフォームへの同期処理
 */
export function syncToQiita() {
  const sourceArticlesDir = path.join(SOURCE_DIR, 'articles');
  const qiitaArticlesDir = path.join(PLATFORMS_DIR, 'qiita', 'articles');

  cleanupRemovedFiles(sourceArticlesDir, qiitaArticlesDir);

  const files = fs.readdirSync(sourceArticlesDir).filter(file => {
    const sourceFile = path.join(sourceArticlesDir, file);
    return file.endsWith('.md') && fs.statSync(sourceFile).isFile();
  });

  for (const file of files) {
    syncQiitaArticle(path.join(sourceArticlesDir, file));
  }
}
