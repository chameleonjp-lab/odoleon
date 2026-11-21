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
├── index.html                        # ホーム、プレイ画面、結果画面の構成
├── styles/
│   └── game.css                      # 色、文字、ボタン、画面サイズごとの配置
├── scripts/
│   ├── game.js                       # 操作、採点、音の再生、3D描画、演出の処理
│   ├── songs.js                      # 収録曲、プレイ用譜面、追加楽曲の譜面生成
│   └── combo-effects.js              # ゲーム内に表示する80演出の名前
├── assets/
│   └── orekameleon.mp3               # メイン曲『オレカメレオン』圧縮済MP3（96kbps, 約1.7MB）
├── data/
│   └── orekameleon_chart.json        # 『オレカメレオン』の譜面（参照・編集用）
├── docs/
│   └── chameleon_80_combo_effects.md # コンボ連動80演出リスト仕様書
└── README.md
```

『オレカメレオン』の譜面を変えるときは、`data/orekameleon_chart.json` と `scripts/songs.js` の `OREKAMELEON_CHART_240` を合わせて更新します。演出の仕様は `docs/`、画面に出る演出名は `scripts/combo-effects.js`、演出の動きは `scripts/game.js` で確認できます。

手元で確認するときはリポジトリ直下で `python3 -m http.server 8000` を実行し、ブラウザで `http://localhost:8000/` を開きます。GitHub Pagesにもこの構成のまま配置できます。

### GitHub Pages 公開手順

1. 上記構成のままプルリクエストを作成し、確認後にデフォルトブランチ（`main`）へマージします。
2. GitHub リポジトリの **Settings > Pages > Build and deployment** で Source を `Deploy from a branch`、Branch を `main` / `/(root)` に設定します。
3. 公開URL（HTTPS）へアクセスし、iPhone Safari または PC ブラウザで「ダンスをスタート！」をタップして動作確認してください。
