# MapPublisher

### ハイキングマップデータの公開

- MapEditor / DownloadArea が出力したファイルを読み込み、内容を確認して公開API へ送信する。
- どのデータも地理院地図上に表示して確認できる。geojson の2つは**公開スキーマへ整形**してから送る。
- 公開するのは次の3つのデータセット。右上のパネルの見出しをクリックして開く（開くのは1つだけ）。
  - **通行止め・通行困難地点** … closures
  - **ハイキングマップデータ** … 緊急ポイント（ポイントGPS）・ハイキングルート・スポット。
    英語名（`englishName`）とルート名も公開する。重なった緊急ポイント・スポットは、
    クリックすると1つのポップアップに並ぶ
  - **地図タイルのダウンロード領域** … tiles。DownloadArea が出力した `tile_manifest.json`。
    GeoJSON ではないため整形せず、`version` だけを画面で指定した値にして送る。
    配信範囲はズームレベルを1つ選んで地図に表示する

**本アプリは編集を行わない。** 地点・ルート・スポットの編集、通行止め地点の登録は MapEditor、
オフライン地図の範囲指定は DownloadArea の役割であり、
本アプリは「読み込む → 確認する → 公開する」に絞っている。

再構成の経緯と全体計画は [docs/migration-plan-202611.md](docs/migration-plan-202611.md) を参照。

## 位置づけ

| 項目 | 内容 |
|------|------|
| 利用者 | 運用担当者専用（MapGPS のカードから開く） |
| 対応端末 | PC専用 |
| 言語 | 日本語のみ |
| オフライン・PWA | 非対応 |
| ホスティング | GitHub Pages（`sato4app/MapPublisher`） |

## 役割分担

| リポジトリ | 役割 |
|---|---|
| MapEditor | 地点・ルート・スポットの編集、通行止め地点の登録。**作業用** geojson を出力する |
| DownloadArea | オフライン地図の対象範囲を指定し、`tile_manifest.json` を出力する。**公開はしない** |
| **MapPublisher** | 作業用ファイルを**公開スキーマへ整形**し、公開API へ送信する。公開の窓口はここに一本化する |
| minoh-hiking | 公開API の実装・配信元、および利用者向け表示アプリ |

編集用の識別子（`spot` の `id` など）は MapEditor の作業ファイルには残し、
**MapPublisher が公開時に落とす**。編集の都合と配信の都合を分離している。

## 開発・動作確認

ES6 モジュール構成のため、CORS 制限を回避するローカルサーバーが必要。

```bash
python -m http.server 8000
# または
npx serve -l 8000 .
# ブラウザで http://localhost:8000 を開く
```

ビルドプロセスは無い。Leaflet 1.9.4 は CDN から読み込む。

## ファイル構成

```
index.html          画面（1画面・右上に操作パネル・開閉式の3セクション）
styles.css          スタイル
js/
  app.js            エントリーポイント。初期化とイベント登録・件数表示・セクションの開閉
  constants.js      定数（地図・マーカースタイル・公開API URL・公開対象 type）
  mapCore.js        地図の初期化・レイヤーの重ね順
  render.js         マーカー描画（geojson の2データセット共通）
  mapData.js        ハイキングマップデータの保持・表示（重なった地点の選択）・公開用整形
  closureData.js    通行止め地点の保持・表示・公開用整形
  tileData.js       タイル一覧の保持・件数・領域表示（整形は行わない）
  fileIO.js         ファイルの読み込み（置換方式）・保存
  publish.js        公開（POST・件数差分の確認・E01〜E06・失敗時の復元）・公開済みデータの出力
  message.js        トーストメッセージ
  version.js        公開バージョン（yyyy.nn）の形式判定と既定値の算出
  utils.js          日付・座標の丸め・任意項目の取り出し・HTMLエスケープ・ファイル保存
docs/               仕様書一式
```

## ドキュメント

| 文書 | 内容 |
|------|------|
| [migration-plan-202611.md](docs/migration-plan-202611.md) | 再構成・移行の実装計画（3リポジトリ横断） |
| [funcspec-202611.md](docs/funcspec-202611.md) | 機能仕様（本アプリの正本） |
| [dataspec-202611.md](docs/dataspec-202611.md) | 入力 GeoJSON の仕様と公開スキーマへの整形規則 |
| [usersGuide-202611.md](docs/usersGuide-202611.md) | 利用者の手引（運用担当者向けの操作手順・エラー対応・トークン設定） |

## 公開API について

公開先は minoh-hiking（別オリジン・CORS 許可済み）。

| メソッド | パス | 用途 |
|---|---|---|
| GET | `/api/manifest` | 各データセットの version・件数（起動時・↻ の表示に使用） |
| GET | `/api/mapdata` `/api/closures` `/api/tiles` | 公開中のデータ（公開前の確認・公開済みデータの出力・失敗時の復元に使用） |
| POST | `/api/mapdata` | ハイキングマップデータの公開（全置換） |
| POST | `/api/closures` | 通行止め地点の公開（全置換） |
| POST | `/api/tiles` | 地図タイルのダウンロード領域の公開（全置換） |

**公開API の仕様は minoh-hiking
[`docs/publish-api-202608.md`](../../ナビアプリ/minoh-hiking/docs/publish-api-202608.md)
（契約バージョン 3.2）が正本であり、本リポジトリには書き写さない。**

座標範囲・`id` 一意・`type` の妥当性、タイルの `z` や `tile_count` の照合といった検証は
サーバーに任せ、失敗時は API が返した日本語メッセージをそのまま表示する（二重管理を避けるため）。
ただし `version`（`yyyy.nn`）は**画面で指定して送る**（既定値は現在公開中 +1）。
形式と現在公開中との重複は、送る前に気づけるよう画面でも確かめる。

## 移行の進捗

- [x] 段階0: 仕様確定（公開API 契約2.0・公開スキーマの策定）
- [x] 段階1: MapPublisher の再構成（編集機能の削除・2データセット公開への対応）
- [x] 段階2: minoh-hiking に公開API を実装（`_lib` 共通化・`mapdata`・`manifest`・`closures` 改修）
- [x] 段階3: ハイキングマップデータの初回公開
- [x] 段階4: minoh-hiking アプリ側の切替（version による更新判定・キャッシュ）
- [ ] 段階5: 後始末（バンドル geojson・旧環境変数・旧履歴は削除済み。旧版互換の `public/closures.js` が残る）
- [x] 段階6: タイル一覧（`tiles`）の公開（契約 2.1）

公開API は稼働中で、`GET /api/manifest` で現在の状況を確認できる。2026-11-22 時点の状況は次のとおり。

| データセット | version | 件数 |
|---|---|---|
| `mapdata` | `2026.01` | 623（ポイント 174 / ルート 261 / スポット 188） |
| `closures` | `2026.13` | 12（通行止め 12 / 通行困難 0） |
| `tiles` | `2026.01` | 1405枚（5レイヤー） |

残作業と稼働状況の詳細は
[migration-plan-202611.md §7](docs/migration-plan-202611.md) を参照。
