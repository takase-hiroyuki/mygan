/* host.css */

* {
    box-sizing: border-box;
    font-size: 16px !important; /* 全ての文字サイズを16pxに強制統一 */
}

body {
    font-family: 'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', Meiryo, sans-serif;
    margin: 0;
    padding: 10px;
    background-color: #f8fafc;
    color: #334155;
    line-height: 1.5;
}

h1 {
    font-size: 24px !important;
    text-align: center;
    border-bottom: 2px solid #cbd5e1;
    padding-bottom: 10px;
    margin-bottom: 20px;
}

/* ==============================
   レイアウトの幅を100%に完全統一
============================== */
fieldset, .table-responsive {
    width: 100%;
    margin-bottom: 20px;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    background-color: #ffffff;
}

fieldset {
    padding: 15px;
}

legend {
    font-weight: bold;
    color: #1e293b;
    padding: 0 5px;
}

.table-responsive {
    padding: 0; /* テーブルコンテナの隙間を消す */
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
}

table {
    width: 100%;
    min-width: max-content; /* 中身に合わせて広がり、画面より大きければスクロール */
    border-collapse: collapse;
}

th, td {
    padding: 10px 12px;
    border: 1px solid #cbd5e1;
    text-align: left;
    vertical-align: middle;
    white-space: nowrap; /* 表の中で文字が勝手に折り返されるのを防ぐ */
}

th {
    background-color: #f1f5f9;
    font-weight: bold;
}

td[align="center"] {
    text-align: center;
}

/* ==============================
   盤面モニター（すごろく）専用の調整
============================== */
.board-table {
    min-width: 1200px; /* 12マスあるため、スクロール前提で広めに確保 */
    width: 100%;
    table-layout: fixed; /* ★重要: セルの幅を中身に依存せず強制的に固定する */
}

.board-table td {
    width: 8.33%; /* ★重要: 100% ÷ 12列 = 8.33% で完全に均等割にする */
    white-space: normal; /* コマがはみ出ないように文字の折り返しを許可 */
    padding: 6px 4px;
    vertical-align: top; /* 複数のコマが入った時に上から整列させる */
    text-align: center;
    overflow: hidden; /* マス目からの中身のはみ出しを防止 */
}

/* ★追加: JSで生成される「プレイヤーのコマ（ネストされたテーブル）」が横に伸びるのを防ぐ */
.player-occupants table {
    min-width: 0 !important; /* max-contentの広がる力を完全に打ち消す */
    width: 100% !important; /* マス目の幅に合わせる */
    table-layout: fixed; /* コマ自体の幅も固定 */
    margin-top: 4px;
    border: none;
}

.player-occupants table td {
    padding: 4px;
    border: none; /* コマ内部の不要な枠線を消す */
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis; /* 名前やIDが長すぎる場合は自動的に「...」にする */
}

/* ==============================
   フォーム・ボタン類
============================== */
input[type="number"], select, textarea {
    padding: 8px;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    background-color: #f1f5f9;
    margin: 4px 0;
    width: auto;
    max-width: 100%;
}

textarea {
    width: 100%;
    resize: vertical;
}

button {
    background-color: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    padding: 8px 16px;
    font-weight: bold;
    cursor: pointer;
    margin: 4px 2px;
    touch-action: manipulation;
}

button:hover:not(:disabled) {
    background-color: #e2e8f0;
}

button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.full-width-btn {
    width: 100%;
    display: block;
    margin-top: 8px;
}

.financial-summary {
    background-color: #f1f5f9;
    padding: 12px;
    border-radius: 4px;
    border: 1px solid #cbd5e1;
    margin-bottom: 15px;
}

.financial-summary p {
    margin: 4px 0;
}

.highlight-cash {
    color: #059669;
    font-weight: bold;
}

/* 盤面モニターのコマの文字設定 */
.player-occupants font {
    display: inline-block;
    color: #ffffff !important;
    font-weight: bold;
    width: 100%; /* セル幅いっぱいにする */
}

/* ==============================
   保有資産一覧テーブル専用の折り返し調整
============================== */
table.asset-table {
    min-width: 100%; /* 横に無限に広がるのを防ぎ、枠に収める */
}

table.asset-table th,
table.asset-table td {
    white-space: normal; /* テキストの折り返しを許可 */
    word-break: break-word; /* 長い文字列でも枠の端で確実に折り返す */
    line-height: 1.6; /* 複数行になった時の見栄えを調整 */
}
