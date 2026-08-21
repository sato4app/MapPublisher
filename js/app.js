// MapPublisher エントリーポイント
//
// MapEditor / DownloadArea が出力したファイルを読み込み → 内容を確認 → 公開する。
// 地点の登録・編集や領域の指定は行わない（それぞれ MapEditor / DownloadArea の役割）。

import { APP_VERSION } from './constants.js';
import { initializeMap } from './mapCore.js';
import { showMessage } from './message.js';
import * as MapData from './mapData.js';
import * as ClosureData from './closureData.js';
import * as TileData from './tileData.js';
import { setupMapDataLoad, setupClosureLoad, setupTileLoad, setupExportButtons } from './fileIO.js';
import { setupPublish } from './publish.js';

// ===== 初期化 =====
const { map } = initializeMap();

MapData.init(map);
ClosureData.init(map);

document.getElementById('appVersion').textContent = `版 ${APP_VERSION}`;

// ===== 件数サマリの表示 =====

function updateMapDataSummary() {
    const summary = document.getElementById('mapDataCounts');
    const note = document.getElementById('mapDataExcluded');

    if (!MapData.isLoaded()) {
        summary.textContent = '未読み込み';
        note.textContent = '';
        return;
    }

    const parts = MapData.getCounts().map(c => `${c.label} ${c.count}`);
    summary.textContent = `${parts.join(' / ')}（計 ${MapData.getTotal()}件）`;
    note.textContent = MapData.getExcludedSummary();
}

function updateClosureSummary() {
    const summary = document.getElementById('closureCounts');
    const note = document.getElementById('closureNote');

    if (!ClosureData.isLoaded()) {
        summary.textContent = '未読み込み';
        note.textContent = '';
        return;
    }

    const counts = ClosureData.getCounts();
    summary.textContent = `通行止め ${counts.closed} / 通行困難 ${counts.difficult}`
        + `（計 ${counts.total}件）`;

    const normalized = ClosureData.getNormalizedCount();
    note.textContent = normalized > 0 ? `区分未設定 ${normalized}件を通行止めとして扱います` : '';
}

// タイル一覧はレイヤー別の枚数を出す。合計だけでは、レイヤーが1つ欠けた
// マニフェストや別範囲のファイルとの取り違えに気づけないため。
function updateTileSummary() {
    const summary = document.getElementById('tileCounts');

    if (!TileData.isLoaded()) {
        summary.textContent = '未読み込み';
        return;
    }

    const parts = TileData.getLayerCounts().map(l => `${l.key} ${l.count}`);
    summary.textContent = `${parts.join(' / ')}（計 ${TileData.getTotal()}枚）`;
}

// ===== ファイル読み込み・出力・公開 =====

setupMapDataLoad(updateMapDataSummary);
setupClosureLoad(updateClosureSummary);
setupTileLoad(updateTileSummary);
setupExportButtons();
setupPublish();

// ===== 公開するデータセットの切り替え =====
// パネルの表示だけを切り替える。地図に出す・出さないは各データセットの
// 「地図に表示」に任せる（通行止め地点をハイキングマップデータに重ねて確かめられるように）。

document.querySelectorAll('input[name="dataset"]').forEach(radio => {
    radio.addEventListener('change', function () {
        if (!this.checked) return;

        document.querySelectorAll('.dataset-selector label span')
            .forEach(span => span.classList.remove('selected'));
        this.nextElementSibling.classList.add('selected');

        document.querySelectorAll('.panel-section[data-panel]').forEach(section => {
            section.hidden = section.dataset.panel !== this.value;
        });
    });
});

// ===== 表示切り替え・消去 =====

document.getElementById('mapDataVisible').addEventListener('change', function () {
    MapData.setVisible(this.checked);
});

document.getElementById('closureVisible').addEventListener('change', function () {
    ClosureData.setVisible(this.checked);
});

document.getElementById('clearMapDataBtn').addEventListener('click', function () {
    if (!MapData.isLoaded()) {
        showMessage('読み込んだハイキングマップデータはありません', 'warning');
        return;
    }
    MapData.clear();
    updateMapDataSummary();
    showMessage('ハイキングマップデータを消去しました', 'success');
});

document.getElementById('clearClosureBtn').addEventListener('click', function () {
    if (!ClosureData.isLoaded()) {
        showMessage('読み込んだ登録地点はありません', 'warning');
        return;
    }
    ClosureData.clear();
    updateClosureSummary();
    showMessage('登録地点を消去しました', 'success');
});

document.getElementById('clearTileBtn').addEventListener('click', function () {
    if (!TileData.isLoaded()) {
        showMessage('読み込んだタイル一覧はありません', 'warning');
        return;
    }
    TileData.clear();
    updateTileSummary();
    showMessage('タイル一覧を消去しました', 'success');
});

// 初期表示
updateMapDataSummary();
updateClosureSummary();
updateTileSummary();
