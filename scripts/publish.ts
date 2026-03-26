import { syncToZenn } from './zenn';
import { syncToQiita } from './qiita';

function main() {
  // 1. Zenn: 同期実行
  syncToZenn();
  console.log('✅ Zenn distribution completed!');

  // 2. Qiita: 変換しながら出力
  syncToQiita();
  console.log('✅ Qiita distribution completed!');
}

// 直接実行時のみメイン処理を動かす（テスト時は動かさない）
if (typeof require !== 'undefined' && require.main === module) {
  main();
}
