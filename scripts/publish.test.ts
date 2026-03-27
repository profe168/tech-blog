import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import matter from 'gray-matter';
import { convertBodyForQiita, convertToQiita } from './qiita.js';
import { cleanupRemovedFiles, listFilesRecursive, parseSourceMetadata } from './shared.js';
import { syncToZenn } from './zenn.js';

const tempDirs: string[] = [];

function createTempDir() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tech-blog-'));
  tempDirs.push(tempDir);
  return tempDir;
}

function writeFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  delete process.env.QIITA_IMAGE_BASE_URL;
});

describe('cleanupRemovedFiles', () => {
  it('source にないファイルを target から削除する', () => {
    const sourceDir = createTempDir();
    const targetDir = createTempDir();

    fs.writeFileSync(path.join(sourceDir, 'keep.md'), '');
    fs.writeFileSync(path.join(targetDir, 'keep.md'), '');
    fs.writeFileSync(path.join(targetDir, 'remove.md'), '');

    cleanupRemovedFiles(sourceDir, targetDir);

    expect(fs.existsSync(path.join(targetDir, 'keep.md'))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, 'remove.md'))).toBe(false);
  });

  it('ネストしたディレクトリでも source にないファイルを削除する', () => {
    const sourceDir = createTempDir();
    const targetDir = createTempDir();

    fs.mkdirSync(path.join(sourceDir, 'nested'), { recursive: true });
    fs.mkdirSync(path.join(targetDir, 'nested'), { recursive: true });
    fs.mkdirSync(path.join(targetDir, 'stale'), { recursive: true });

    fs.writeFileSync(path.join(sourceDir, 'nested', 'keep.md'), '');
    fs.writeFileSync(path.join(targetDir, 'nested', 'keep.md'), '');
    fs.writeFileSync(path.join(targetDir, 'nested', 'remove.md'), '');
    fs.writeFileSync(path.join(targetDir, 'stale', 'remove.md'), '');

    cleanupRemovedFiles(sourceDir, targetDir);

    expect(fs.existsSync(path.join(targetDir, 'nested', 'keep.md'))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, 'nested', 'remove.md'))).toBe(false);
    expect(fs.existsSync(path.join(targetDir, 'stale'))).toBe(false);
  });
});

describe('listFilesRecursive', () => {
  it('ネストしたファイルを再帰的に列挙する', () => {
    const sourceDir = createTempDir();

    fs.mkdirSync(path.join(sourceDir, 'nested', 'deep'), { recursive: true });
    fs.writeFileSync(path.join(sourceDir, 'root.md'), '');
    fs.writeFileSync(path.join(sourceDir, 'nested', 'child.md'), '');
    fs.writeFileSync(path.join(sourceDir, 'nested', 'deep', 'note.txt'), '');

    const files = listFilesRecursive(sourceDir, file => file.endsWith('.md'))
      .map(file => path.relative(sourceDir, file).replaceAll('\\', '/'))
      .sort();

    expect(files).toEqual(['nested/child.md', 'root.md']);
  });
});

describe('parseSourceMetadata', () => {
  it('必要なメタデータを返す', () => {
    expect(parseSourceMetadata({
      title: 'hello',
      tags: ['typescript', 'qiita']
    })).toEqual({
      title: 'hello',
      tags: ['typescript', 'qiita']
    });
  });

  it('tags が空なら例外を投げる', () => {
    expect(() => parseSourceMetadata({
      title: 'hello',
      tags: []
    })).toThrow('required metadata: title, tags');
  });
});

describe('convertBodyForQiita', () => {
  it('既定の公開 URL に画像URLを変換する', () => {
    const converted = convertBodyForQiita('![img](/images/train.jpg)');

    expect(converted).toBe('![img](https://cdn.jsdelivr.net/gh/profe168/tech-blog@master/source/images/train.jpg)');
  });

  it('環境変数で画像URLのベースを上書きできる', () => {
    process.env.QIITA_IMAGE_BASE_URL = 'https://example.com/assets';

    const converted = convertBodyForQiita('![img](/images/train.jpg)');

    expect(converted).toBe('![img](https://example.com/assets/images/train.jpg)');
  });

  it('message 記法を Qiita 向け note 記法に変換する', () => {
    const converted = convertBodyForQiita(':::message alert\nhello\n:::');

    expect(converted).toBe(':::note warn\nhello\n:::');
  });
});

describe('convertToQiita', () => {
  it('ネストした記事を変換し、既存 ID を維持する', () => {
    const tempRoot = createTempDir();
    const sourceArticlesDir = path.join(tempRoot, 'source', 'articles');
    const qiitaPublicDir = path.join(tempRoot, 'platforms', 'qiita', 'public');

    writeFile(
      path.join(sourceArticlesDir, 'nested', 'hello.md'),
      '---\ntitle: "Hello"\ntags: ["typescript", "qiita"]\n---\n\n![img](/images/train.jpg)\n'
    );
    writeFile(
      path.join(qiitaPublicDir, 'nested', 'hello.md'),
      '---\nid: abc123\ntitle: Old\ntags: ["old"]\nprivate: true\n---\n\nold\n'
    );

    convertToQiita({
      sourceArticlesDir,
      qiitaPublicDir,
      imageBaseUrl: 'https://example.com/source'
    });

    const output = matter.read(path.join(qiitaPublicDir, 'nested', 'hello.md'));
    expect(output.data).toMatchObject({
      id: 'abc123',
      title: 'Hello',
      tags: ['typescript', 'qiita'],
      private: true
    });
    expect(output.content).toContain('![img](https://example.com/source/images/train.jpg)');
  });
});

describe('syncToZenn', () => {
  it('ネストした記事と画像を同期し、不要ファイルを削除する', () => {
    const tempRoot = createTempDir();
    const sourceRootDir = path.join(tempRoot, 'source');
    const zennDir = path.join(tempRoot, 'platforms', 'zenn');

    writeFile(path.join(sourceRootDir, 'articles', 'nested', 'hello.md'), '# hello\n');
    writeFile(path.join(sourceRootDir, 'images', 'nested', 'train.jpg'), 'image');
    writeFile(path.join(zennDir, 'articles', 'stale.md'), 'stale');
    writeFile(path.join(zennDir, 'images', 'old', 'stale.jpg'), 'stale');

    syncToZenn({ sourceRootDir, zennDir });

    expect(fs.readFileSync(path.join(zennDir, 'articles', 'nested', 'hello.md'), 'utf8')).toBe('# hello\n');
    expect(fs.readFileSync(path.join(zennDir, 'images', 'nested', 'train.jpg'), 'utf8')).toBe('image');
    expect(fs.existsSync(path.join(zennDir, 'articles', 'stale.md'))).toBe(false);
    expect(fs.existsSync(path.join(zennDir, 'images', 'old'))).toBe(false);
  });
});
