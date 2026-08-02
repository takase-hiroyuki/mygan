// common_utils.js

import { roomId } from './common_config.js';
import { SEL_G } from './common_dom_selectors.js'; // ★修正: SEL_G を直接インポート

// index.js と host.js の両方から参照される関数群

/**
 * SupabaseのRPC関数を安全に呼び出し、入出力をデバッグするためのラッパー関数。
 * データベースの不整合や予期せぬ引数のエラーを即座に検知する。
 */
export async function callRpcWithDebug(supabaseClient, rpcName, params = {}) {
    const startTime = performance.now();
    console.log(`[RPC_CALL_START] ${rpcName}`);
    console.log(`[RPC_PARAMS]`, JSON.stringify(params, null, 2));
    
    const { data, error } = await supabaseClient.rpc(rpcName, params);
    
    const endTime = performance.now();
    const executionTime = (endTime - startTime).toFixed(2);

    if (error) {
        console.error(`[RPC_CALL_FAILED] ${rpcName} (${executionTime}ms)`);
        console.error(`[RPC_ERROR_DETAILS]`, error);
        throw new Error(`RPC実行エラー: ${error.message}`);
    }

    console.log(`[RPC_CALL_SUCCESS] ${rpcName} (${executionTime}ms)`);
    console.log(`[RPC_RETURN_VALUE]`, data !== null ? JSON.stringify(data, null, 2) : 'No returning data (void)');

    // 整合性監視: RPC関数側で定義された論理エラー（JSONBのstatus: 'error'）の検知
    if (data && typeof data === 'object' && data.status === 'error') {
        console.warn(`[RPC_LOGICAL_WARNING] ${rpcName} はエラー状態を返却しました。Message: ${data.message}`);
    }

    return data;
}

/**
 * 単一のボタンの有効/無効とテキストプレフィックス(O/X)を同期する
 */
export function setButtonActive(id, isActive) {
    const btn = document.getElementById(id);
    if (!btn) return;

    btn.disabled = !isActive;

    // 現在のテキストから先頭の "O " または "X " を正規表現で取り除く
    const baseText = btn.innerText.replace(/^[OX]\s/, '');
    
    // 状態に応じたプレフィックスを付与してテキストを上書き
    btn.innerText = (isActive ? 'O ' : 'X ') + baseText;
}

/**
 * 複数のボタンの一括状態変更を行う
 */
export function setMultipleButtonsActive(ids, isActive) {
    ids.forEach(id => setButtonActive(id, isActive));
}

export const BOARD_CELL_NAMES = [
    "入金", "娯楽", "好機", "寄付", "好機", "入金", "好機", "娯楽",
    "好機", "子供", "好機", "入金", "市場", "好機", "娯楽", "好機",
    "寄付", "好機", "入金", "好機", "解雇", "好機", "市場", "好機"
];

/**
 * window.supabase のロードを安全に待機する関数
 */
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

// =========================================================================
// 盤面の特定のマスを示す定数 (CELLS_... 形式に統一)
// =========================================================================
export const CELLS_PAYDAY = [0, 5, 11, 18];        // 入金（給料マイナス経費）
export const CELLS_OPPORTUNITY = [2, 4, 6, 8, 10, 13, 15, 17, 19, 21, 23]; // 好機
export const CELLS_DOODAD = [1, 7, 14];            // 娯楽
export const CELLS_MARKET = [12, 22];              // 市場
export const CELLS_BABY = [9];                     // 子供
export const CELLS_CHARITY = [3, 16];              // 寄付
export const CELLS_DOWNSIZED = [20];               // 解雇

/**
 * プレイヤーの初期登録データを生成する関数
 */
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
        // 最新のスキーマ（整数値フラグへの統合）に合わせる
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
            cash: 0, total_income: 0, total_expenses: 0, passive_income: 0, net_cash_flow: 0, per_child_expense: 0,
            // 最新のJSONスキーマに合わせてキー名を修正・補完
            expenses: { 
                taxes: 0, 
                mortgage_payment: 0, 
                school_loan_payment: 0,
                car_loan_payment: 0, 
                credit_card_payment: 0,
                retail_payment: 0,
                bank_loan_payment: 0,
                other_expenses: 0,
                child_expense: 0 
            },
            assets: { stocks: {}, real_estate: [] },
            liabilities: { 
                mortgage: 0, 
                school_loans: 0,
                car_loans: 0, 
                credit_card_debt: 0,
                retail_debt: 0, 
                bank_loan: 0 
            }
        }
    };
}

// =========================================================================
// システムメッセージ・エラーログ共通関数
// =========================================================================

/**
 * 画面（DOM）から現在のプレイヤー名を取得するヘルパー関数
 * 各ファイルで重複定義されていたものをここに集約
 */
export function getLocalPlayerName() {
    const nameEl = document.getElementById(SEL_G.STATUS.NAME);
    return (nameEl && nameEl.textContent !== '未定') ? nameEl.textContent : 'プレイヤー';
}

/**
 * システムメッセージ（エラー含む）をデータベース(game_logs)に書き込む汎用関数
 */
export async function insertSystemMessage(supabase, target, message) {
    try {
        await supabase.rpc('fn_insert_game_log', {
            p_room_id: roomId, 
            p_target: target,
            p_title: 'システム',
            p_body: message
        });
    } catch (err) {
        console.error("システムメッセージ保存失敗:", err);
    }
}

/**
 * システムメッセージをDOMのテーブルに追記する関数
 * @param {string} target - メッセージの宛先（1番目のtd用）
 * @param {string} body - メッセージ本文（2番目のtd用）
 */
export function displaySystemMessage(target, body) {
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
}

console.log("【デバッグ】common_utils.js が読み込まれました。");
