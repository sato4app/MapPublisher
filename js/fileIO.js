// 公開するファイルの読み込みと、ファイル保存の共通処理
//
// 読み込みはどのデータセットも「置換」方式（各データモジュールの load を参照）。
//
// 出力するのは公開済みデータであり、その取得とファイル名の組み立ては publish.js が持つ
// （公開APIから取ってくる処理と同じ場所にあるほうが追いやすいため）。
// ここには保存の作法だけを置く。

import { MAPDATA_FILE_PREFIXES, CLOSURE_FILE_PREFIXES } from './constants.js';
import { showMessage } from './message.js';
import { saveBlobAsFile } from './utils.js';
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

// 0件のファイルは名前でデータセットを確かめる（constants.js の *_FILE_PREFIXES を参照）
function checkEmptyFileName(json, fileName, prefixes) {
    if (!json || !Array.isArray(json.features) || json.features.length > 0) return;
    if (!prefixes.some(prefix => fileName.startsWith(prefix))) {
        throw new Error(`0件のファイルは、名前が ${prefixes.join(' か ')} で始まるものだけ読み込めます`);
    }
}

function showEmptyLoaded(fileName, label) {
    showMessage(`${fileName}: 0件のデータを読み込みました\n`
        + `公開すると、公開中の${label}がすべて地図から消えます`, 'warning');
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
        checkEmptyFileName(json, fileName, MAPDATA_FILE_PREFIXES);
        const result = MapData.load(json);

        if (result.total === 0) {
            showEmptyLoaded(fileName, 'ハイキングマップデータ');
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
        checkEmptyFileName(json, fileName, CLOSURE_FILE_PREFIXES);
        const result = ClosureData.load(json);

        if (result.total === 0) {
            showEmptyLoaded(fileName, '通行止め・通行困難地点');
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

// ===== 出力 =====

// 中身をファイルとして保存する。GeoJSON かどうかで拡張子の候補と MIME を変える
// （tiles は GeoJSON ではない。契約 2.1 §3.6）。
export async function saveAsFile(body, filename) {
    const geoJson = body.type === 'FeatureCollection';
    const blob = new Blob([JSON.stringify(body, null, 2)], {
        type: geoJson ? 'application/geo+json' : 'application/json'
    });
    return saveBlobAsFile(blob, filename, geoJson ? 'GeoJSON Files' : 'JSON Files');
}
