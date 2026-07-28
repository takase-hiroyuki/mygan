// common_utils.js

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

// 盤面の特定のマスを示す定数
export const PAYDAY_CELLS = [0, 5, 11, 18];        // 入金（給料マイナス経費）
export const OPPORTUNITY_CELLS = [2, 4, 6, 8, 10, 13, 15, 17, 19, 21, 23]; // 好機
export const DOODAD_CELLS = [1, 7, 14];            // 娯楽
export const MARKET_CELLS = [12, 22];              // 市場
export const BABY_CELLS = [9];                     // 子供
export const CHARITY_CELLS = [3, 16];              // 寄付
export const DOWNSIZED_CELLS = [20];               // 解雇

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
        is_calculating: false,
        calculation_phase: "none",
        children_count: 0,
        charity_turns_left: 0,
        downsized_turns_left: 0,
        flags: {
            has_rolled_dice: false,
            is_card_drawn: false,
            is_action_completed: false,
            is_calculating: false,
            is_negative_cash_flow: false
        },
        financials: {
            cash: 0, total_income: 0, total_expenses: 0, passive_income: 0, net_cash_flow: 0,
            expenses: { taxes: 0, mortgage_payment: 0, car_loan_payment: 0, loan_interest: 0, child_expense: 0, other: 0 },
            assets: { stocks: {}, real_estate: [] },
            liabilities: { mortgage: 0, car_loan: 0, retail_debt: 0, bank_loan: 0 }
        }
    };
}

console.log("【デバッグ】common_utils.js が読み込まれました。");
