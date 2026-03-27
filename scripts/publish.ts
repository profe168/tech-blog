import { pathToFileURL } from 'node:url';
import { syncToZenn } from './zenn.js';
import { convertToQiita } from './qiita.js';

function main() {
  // Zenn: 変換せずに同期
  syncToZenn();
  console.log('✅ Zenn distribution completed!');

  // Qiita: 記事を変換して出力
  convertToQiita();
  console.log('✅ Qiita distribution completed!');
}

// ローカルかCI実行時のみ実行（テスト時は実行しない）
const isMainModule = process.argv[1] != null
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  main();
}
