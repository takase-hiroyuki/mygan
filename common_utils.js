// common_utils.js

import { roomId } from './common_config.js';
import { SEL_G } from './common_dom_selectors.js';

// ★ 新設: ログを game_logs テーブルへ出力する汎用関数
let localSeqCounter = 0;
export function writeLog(supabaseClient, target, title, body) {
    if (!supabaseClient) return;
    
    // sequence_numは integer 型 (上限約21.4億) のため、現在時刻(秒) + ローカルカウンターで一意性と順序を担保
    const seqNum = Math.floor(Date.now() / 1000) + (localSeqCounter++); 
    
    const bodyStr = typeof body === 'object' ? JSON.stringify(body, null, 2) : String(body);
    
    // ※UI処理をブロックしないよう、awaitせずに非同期でINSERTを投げる
    supabaseClient.from('game_logs').insert([{
        room_id: roomId,
        sequence_num: seqNum,
        target: target,
        title: title,
        body: bodyStr
    }]).then(({ error }) => {
        if (error) {
            // スクリプトエラー等でDBに書き込めない異常事態のみ、コンソールに残す
            console.error("【残す】game_logsへの保存エラー:", error);
        }
    });
}

// index.js と host.js の両方から参照される関数群

// SupabaseのRPC関数を安全に呼び出し、入出力をデバッグするためのラッパー関数。
export async function callRpcWithDebug(supabaseClient, rpcName, params = {}) {
    const startTime = performance.now();
    
    // ★ 修正: console.log を writeLog に置き換え
    writeLog(supabaseClient, "System", "RPC_CALL_START", `RPC: ${rpcName}\nParams: ${JSON.stringify(params, null, 2)}`);
    
    const { data, error } = await supabaseClient.rpc(rpcName, params);
    
    const endTime = performance.now();
    const executionTime = (endTime - startTime).toFixed(2);

    if (error) {
        writeLog(supabaseClient, "System", "RPC_CALL_FAILED", `RPC: ${rpcName} (${executionTime}ms)\nError: ${JSON.stringify(error, null, 2)}`);
        throw new Error(`RPC実行エラー: ${error.message}`);
    }

    const responseBody = data !== null ? JSON.stringify(data, null, 2) : 'No returning data (void)';
    writeLog(supabaseClient, "System", "RPC_CALL_SUCCESS", `RPC: ${rpcName} (${executionTime}ms)\nResult: ${responseBody}`);

    // 整合性監視: RPC関数側で定義された論理エラー（JSONBのstatus: 'error'）の検知
    if (data && typeof data === 'object' && data.status === 'error') {
        writeLog(supabaseClient, "System", "RPC_LOGICAL_WARNING", `RPC: ${rpcName} はエラー状態を返却しました。\nMessage: ${data.message}`);
    }

    return data;
}

// 単一のボタンの有効/無効とテキストプレフィックス(O/X)を同期する
export function setButtonActive(id, isActive) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.disabled = !isActive;
    const baseText = btn.innerText.replace(/^[OX]\s/, '');
    btn.innerText = (isActive ? 'O ' : 'X ') + baseText;
}

// 複数のボタンの一括状態変更を行う
export function setMultipleButtonsActive(ids, isActive) {
    ids.forEach(id => setButtonActive(id, isActive));
}

export const BOARD_CELL_NAMES = [
    "入金", "娯楽", "商売", "寄付", "商売", "入金", "商売", "娯楽",
    "商売", "子供", "商売", "入金", "市場", "商売", "娯楽", "商売",
    "寄付", "商売", "入金", "商売", "解雇", "商売", "市場", "商売"
];

// window.supabase のロードを安全に待機する関数
export function waitForSupabase() {
    return new Promise((resolve) => {
        if (window.supabase) {
            resolve(window.supabase);
            return;
        }
        const interval = setInterval(() => {
            if (window.supabase) {
                clearInterval(interval);
                resolve(window.supabase);
            }
        }, 50);
    });
}

// 盤面の特定のマスを示す定数 (CELLS_... 形式に統一)
export const CELLS_PAYDAY = [0, 5, 11, 18];        // 入金（給料マイナス経費）
export const CELLS_OPPORTUNITY = [2, 4, 6, 8, 10, 13, 15, 17, 19, 21, 23]; // 商売
export const CELLS_DOODAD = [1, 7, 14];            // 娯楽
export const CELLS_MARKET = [12, 22];              // 市場
export const CELLS_BABY = [9];                     // 子供
export const CELLS_CHARITY = [3, 16];              // 寄付
export const CELLS_DOWNSIZED = [20];               // 解雇

// プレイヤーの初期登録データを生成する関数
export function getInitialRegistrationState(username) {
    return {
        name: username,
        role: "general",
        profession: "未定",
        game_phase: "rat_race",
        position: 0,
        last_dice: 0,
        calculation_phase: "none",
        children_count: 0,

        // すべての資産・負債・固定費・給料はここにアイテムとして入る
        items: [], 

        flags: {
            has_rolled_dice: false,
            is_card_drawn: false,
            is_action_completed: false,
            is_calculating: false,
            is_negative_cash_flow: false,
            charity_turns_left: 0,
            downsized_turns_left: 0,
            pending_paydays: 0
        },
        
        financials: {
            // お財布の状況（現金）や、キャッシュフローの合計値など、
            // 「アイテムの計算結果」や「現在の状態」を入れる場所だけ残す
            cash: 0, 
            total_income: 0, 
            total_expenses: 0, 
            passive_income: 0, 
            net_cash_flow: 0, 
            per_child_expense: 0
        }
    };
}

// 画面（DOM）から現在のプレイヤー名を取得するヘルパー関数
export function getLocalPlayerName() {
    const nameEl = document.getElementById(SEL_G.STATUS.NAME);
    return (nameEl && nameEl.textContent !== '未定') ? nameEl.textContent : 'プレイヤー';
}

export async function insertSystemMessage(supabase, targetName, message) {
    // ★ 修正: ダミー化されていた機能を writeLog に接続し復活させる
    writeLog(supabase, targetName, "Message", message);
    return { data: null, error: null };
}

/**
 * システムメッセージをDOMのテーブルに追記する関数
 * @param {string} target - メッセージの宛先（1番目のtd用）
 * @param {string} body - メッセージ本文（2番目のtd用）
 */
export function displaySystemMessage(target, body) {
    /*
    const tbody = document.getElementById(SEL_G.MESSAGE.TABLE_BODY); // ★修正: DOM_SELECTORS.GUEST を SEL_G に変更
    if (!tbody) {
        console.warn("[WARNING] message-table-body が見つかりません。メッセージの表示をスキップします。");
        return;
    }

    const tr = document.createElement('tr');
    const tdTarget = document.createElement('td');
    tdTarget.textContent = target;
    const tdBody = document.createElement('td');
    tdBody.textContent = body;
    tr.appendChild(tdTarget);
    tr.appendChild(tdBody);
    
    // 古いログが上になり、最新ログが下に追加されていく
    tbody.appendChild(tr);

    // スクロールコンテナの最下部へ自動スクロール
    const scrollContainer = tbody.parentElement.parentElement;
    if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }

    console.log(`[game_logs] ${target} / ${body}`);
    */
}

console.log("【残す】common_utils.js が読み込まれました。");
