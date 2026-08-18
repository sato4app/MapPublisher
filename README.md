# ClosureEditor

### 通行止め・通行困難地点の管理

- 緊急ポイント・ハイキングルートのgeojsonファイルを読み込み、地理院地図上にハイキングマップとして表示する。
- ハイキングマップにおける、通行止め・通行困難地点（以下 closures）の位置指定を行う。
- 登録した地点は、標高を取得する。
- 登録した地点は、geojsonファイルにて出力可能とする。
- 通行止め・通行困難地点は、ユーザーに対して別アプリ(minoh-hiking)にて公開する。

これまで MapEditor（位置指定）と minoh-hiking（公開）に分かれていた機能を、
**位置指定から公開まで**を1つのアプリで完結させるかたちに集約したもの。
集約の経緯は [docs/funcspec-202607.md §1.3](docs/funcspec-202607.md) を参照。

## 位置づけ

| 項目 | 内容 |
|------|------|
| 利用者 | 運用担当者専用（MapGPS のカードから開く） |
| 対応端末 | PC専用 |
| 言語 | 日本語のみ |
| オフライン・PWA | 非対応 |
| ホスティング | GitHub Pages（`sato4app/ClosureEditor`） |

## 開発・動作確認

ES6 モジュール構成のため、CORS 制限を回避するローカルサーバーが必要。

```bash
python -m http.server 8000
# または
npx serve .
# ブラウザで http://localhost:8000 を開く
```

ビルドプロセスは無い。Leaflet 1.9.4 は CDN から読み込む。

## ファイル構成

```
index.html          画面（1画面のみ・右上に操作パネル）
styles.css          スタイル
js/
  app.js            エントリーポイント。初期化とイベント登録
  constants.js      定数（地図・マーカースタイル・公開API URL・版日付）
  mapCore.js        地図の初期化・レイヤーの重ね順
  closureEditor.js  登録地点の状態管理・マーカー描画・追加/移動/削除・属性編集・標高付与
  fileIO.js         geojson の読み込み・出力
  publish.js        公開（POST・E01〜E05・バックアップ保存）
  basemap.js        背景（ハイキングマップ）の表示
  elevation.js      国土地理院標高API
  message.js        トーストメッセージ
  utils.js          日付・座標の丸め・ファイル保存
docs/               仕様書一式
```

## ドキュメント

| 文書 | 内容 |
|------|------|
| [funcspec-202607.md](docs/funcspec-202607.md) | 機能仕様（本アプリの正本）。公開API の契約項目・セキュリティ上の考慮を含む |
| [dataspec-202607.md](docs/dataspec-202607.md) | GeoJSON データ仕様（正本） |
| [usersGuide-202607.md](docs/usersGuide-202607.md) | 利用者の手引（運用担当者向けの操作手順・エラー対応・トークン設定） |

この3文書で完結する。移行検討結果・minoh-hiking 側の設計書・テスト計画は
minoh-hiking リポジトリ側の文書であり、本リポジトリには置かない。

## 公開API について

公開先は minoh-hiking の `POST /api/closures`（別オリジン・CORS 許可済み）。

**公開API の仕様は minoh-hiking 設計書 §5（契約バージョン 1.0）が正本であり、
本リポジトリには書き写さない。** 座標範囲・`id` 一意・`version` 必須といった検証は
サーバーに任せ、失敗時は API が返した日本語メッセージをそのまま表示する
（二重管理を避けるため）。依存している契約項目のみ
[機能仕様 §6](docs/funcspec-202607.md) に列挙する。

## 移行の進捗

- [x] 段階0: 仕様確定（機能仕様・データ仕様・利用者の手引の作成）
- [x] 段階1: ClosureEditor 作成
- [ ] 段階2: ClosureEditor で実際に1回公開し、minoh-hiking の表示で確認
- [ ] 段階3: MapGPS のカード差し替え（運用手順は利用者の手引へ移管済み）
- [ ] 段階4: MapEditor から closures 機能を削除
- [ ] 段階5: minoh-hiking を表示専用化
- [ ] 段階6: minoh-hiking 一般公開

段階2を通過するまで、MapEditor・minoh-hiking の既存経路はそのまま残す。
