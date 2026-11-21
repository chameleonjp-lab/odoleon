# odoreon
オドレオン

## カメレオン・ダンス・リズム（Chameleon Dance Rhythm 3D）

Three.js（WebGL）と Web Audio API で構築した、モバイルファースト（iPhone / Safari 対応）のフル3Dカメレオン・リズムゲームです。

### 主な特徴
- **フル3D立体カメレオン（最大66匹同時ダンス）**: 主人公1匹＋後列バックダンサー最大55匹＋手前子供カメレオン最大5匹＋手前ブレイクダンス隊最大5匹
- **6種類のダンスボタン＆連動トリック**: `1:ポーズ` / `2:スピン` / `3:ステップ` / `4:ウェーブ` / `5:ジャンプ` / `6:フィニッシュ`（PCキーボード `1〜6` または `A S D J K L` でも操作可能）
- **1〜80コンボ連動演出**: 1コンボごとに1つずつ新演出が解放・累積（画面酔い防止のためカメラの揺れ・傾き・脈動は完全排除）
- **楽曲選択＆カスタム曲追加**: メイン曲『オレカメレオン』（164.38 BPM / 全240ノーツ）と『ネオン・カメレオン（お試し1分ver. / 全80ノーツ）』を収録。端末のWAV/MP3を読み込んで240ノーツ自動生成も可能

### ディレクトリ構成（GitHub Pages用）
```text
.
├── index.html                        # ゲーム本体（Three.js CDN + Web Audio API）
├── assets/
│   └── orekameleon.mp3               # メイン曲『オレカメレオン』圧縮済MP3（96kbps, 約1.7MB）
├── data/
│   └── orekameleon_chart.json        # 164.38 BPM / 240ノーツ譜面データ（参照・編集用）
├── docs/
│   └── chameleon_80_combo_effects.md # コンボ連動80演出リスト仕様書
└── README.md
```

### GitHub Pages 公開手順
1. 上記構成のままプルリクエストを作成し、確認後にデフォルトブランチ（`main`）へマージします。
2. GitHub リポジトリの **Settings > Pages > Build and deployment** で Source を `Deploy from a branch`、Branch を `main` / `/(root)` に設定します。
3. 公開URL（HTTPS）へアクセスし、iPhone Safari または PC ブラウザで「ダンスをスタート！」をタップして動作確認してください。
