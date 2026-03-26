import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { convertBodyForQiita } from './qiita';
import { cleanupRemovedFiles } from './shared';

const tempDirs: string[] = [];

function createTempDir() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tech-blog-'));
  tempDirs.push(tempDir);
  return tempDir;
}

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  delete process.env.GITHUB_REPOSITORY;
  delete process.env.GITHUB_REF_NAME;
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
});

describe('convertBodyForQiita', () => {
  it('GitHub 情報がある場合は画像URLを CDN URL に変換する', () => {
    process.env.GITHUB_REPOSITORY = 'owner/repo';
    process.env.GITHUB_REF_NAME = 'main';

    const converted = convertBodyForQiita('![img](/images/train.jpg)');

    expect(converted).toBe('![img](https://cdn.jsdelivr.net/gh/owner/repo@main/source/images/train.jpg)');
  });

  it('GitHub 情報がない場合は画像URLをそのまま維持する', () => {
    const converted = convertBodyForQiita('![img](/images/train.jpg)');

    expect(converted).toBe('![img](/images/train.jpg)');
  });

  it('message 記法を Qiita 向け note 記法に変換する', () => {
    const converted = convertBodyForQiita(':::message alert\nhello\n:::');

    expect(converted).toBe(':::note warn\nhello\n:::');
  });
});
