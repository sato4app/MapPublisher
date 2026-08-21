// 公開するファイルの読み込みと出力
//
// 読み込みはどのデータセットも「置換」方式（各データモジュールの load を参照）。
// 出力は公開スキーマへ整形した結果を保存する。公開前の内容確認と、
// 公開に失敗したときの控えの2つの用途がある。
//
// tiles は GeoJSON ではない（契約 2.1 §3.6）ため、出力の形も別に持つ。

import { showMessage } from './message.js';
import { getDateString, getDateTimeIso, saveBlobAsFile } from './utils.js';
import * as MapData from './mapData.js';
import * as ClosureData from './closureData.js';
import * as TileData from './tileData.js';

// ===== 読み込み =====

async function readJson(file) {
    try {
        return JSON.parse(await file.text());
    } catch {
        throw new Error('JSONとして読み込めません');
    }
}

// ファイル選択のイベントを配線する。読み込み後に onLoaded を呼ぶ。
function bindFileInput(inputId, handler, onLoaded) {
    document.getElementById(inputId).addEventListener('change', async function () {
        const file = this.files[0];
        if (!file) return;

        try {
            const json = await readJson(file);
            handler(json, file.name);
            onLoaded();
        } catch (error) {
            console.error('読み込みエラー:', error);
            showMessage(`読み込みエラー (${file.name}): ${error.message}`, 'error');
        } finally {
            // 同じファイルを選び直せるように値を消す
            this.value = '';
        }
    });
}

export function setupMapDataLoad(onLoaded) {
    bindFileInput('mapDataFileInput', (json, fileName) => {
        const result = MapData.load(json);

        if (result.total === 0) {
            showMessage(`${fileName}: 公開対象のデータが見つかりませんでした`, 'warning');
            return;
        }

        const parts = MapData.getCounts().map(c => `${c.label} ${c.count}`);
        const excluded = MapData.getExcludedSummary();
        const msg = `${result.total}件を読み込みました（${parts.join(' / ')}）`;

        showMessage(excluded ? `${msg}\n${excluded}は公開しません` : msg, 'success');
    }, onLoaded);
}

export function setupClosureLoad(onLoaded) {
    bindFileInput('closureFileInput', (json, fileName) => {
        const result = ClosureData.load(json);

        if (result.total === 0) {
            showMessage(`${fileName}: 通行止め・通行困難地点が見つかりませんでした`, 'warning');
            return;
        }

        const counts = ClosureData.getCounts();
        const msg = `${result.total}件を読み込みました（通行止め ${counts.closed} / 通行困難 ${counts.difficult}）`;

        // 区分が未選択・不正だった地点は既定値へ寄せている。黙って変えると気づけないため知らせる
        if (result.normalized > 0) {
            showMessage(`${msg}\n区分が未設定の${result.normalized}件を「通行止め」として扱います`, 'warning');
        } else {
            showMessage(msg, 'success');
        }
    }, onLoaded);
}

export function setupTileLoad(onLoaded) {
    bindFileInput('tileFileInput', (json, fileName) => {
        const result = TileData.load(json);

        if (result.total === 0) {
            showMessage(`${fileName}: タイルが1枚もありません`, 'warning');
            return;
        }

        const parts = TileData.getLayerCounts().map(l => `${l.key} ${l.count}`);
        showMessage(`${result.total}枚を読み込みました（${parts.join(' / ')}）`, 'success');
    }, onLoaded);
}

// ===== 出力ファイル名 =====

// 出力ファイル名: MapData-yyyymmdd_P{ポイント}_R{ルート}_S{スポット}.geojson
export function buildMapDataFileName() {
    const c = Object.fromEntries(MapData.getCounts().map(x => [x.type, x.count]));
    return `MapData-${getDateString()}`
        + `_P${c['ポイントGPS'] || 0}_R${c.route || 0}_S${c.spot || 0}.geojson`;
}

// 出力ファイル名: Closure-yyyymmdd_C{通行止め}_D{通行困難}.geojson
export function buildClosureFileName() {
    const counts = ClosureData.getCounts();
    return `Closure-${getDateString()}_C${counts.closed}_D${counts.difficult}.geojson`;
}

// 出力ファイル名: TileManifest-yyyymmdd_L{レイヤー数}_T{タイル枚数}.json
// レイヤー別の枚数は5つあり名前に入れると長すぎるため、合計だけを付ける
export function buildTileFileName() {
    return `TileManifest-${getDateString()}`
        + `_L${TileData.getLayerCounts().length}_T${TileData.getTotal()}.json`;
}

// ===== 出力 =====

// 出力する中身を作る。version はサーバーが採番するため含めない（updatedAt は出力日時）。

// GeoJSON データセット（mapdata / closures）
export function toGeoJsonFileBody(data) {
    return {
        type: 'FeatureCollection',
        updatedAt: getDateTimeIso(),
        features: data.features
    };
}

// tiles（契約 §3.6。GeoJSON ではないので FeatureCollection の形にしない）
export function toTileFileBody(data) {
    return {
        updatedAt: getDateTimeIso(),
        source: data.source || '',
        layers: data.layers
    };
}

// 出力する中身（to〜FileBody の戻り値）をファイルとして保存する
export async function saveAsFile(body, filename) {
    const geoJson = body.type === 'FeatureCollection';
    const blob = new Blob([JSON.stringify(body, null, 2)], {
        type: geoJson ? 'application/geo+json' : 'application/json'
    });
    return saveBlobAsFile(blob, filename, geoJson ? 'GeoJSON Files' : 'JSON Files');
}

export function setupExportButtons() {
    document.getElementById('exportMapDataBtn').addEventListener('click', async function () {
        if (!MapData.isLoaded()) {
            showMessage('出力するハイキングマップデータがありません', 'warning');
            return;
        }
        const saved = await saveAsFile(
            toGeoJsonFileBody(MapData.buildPublishData()), buildMapDataFileName());
        if (saved) showMessage('公開スキーマへ整形して出力しました', 'success');
    });

    document.getElementById('exportClosureBtn').addEventListener('click', async function () {
        if (!ClosureData.isLoaded()) {
            showMessage('出力する登録地点がありません', 'warning');
            return;
        }
        const saved = await saveAsFile(
            toGeoJsonFileBody(ClosureData.buildPublishData()), buildClosureFileName());
        if (saved) showMessage('公開スキーマへ整形して出力しました', 'success');
    });

    // tiles は整形しない。読み込んだ内容の控えを取る用途で出力する
    document.getElementById('exportTileBtn').addEventListener('click', async function () {
        if (!TileData.isLoaded()) {
            showMessage('出力するタイル一覧がありません', 'warning');
            return;
        }
        const saved = await saveAsFile(
            toTileFileBody(TileData.buildPublishData()), buildTileFileName());
        if (saved) showMessage('読み込んだタイル一覧を出力しました', 'success');
    });
}
