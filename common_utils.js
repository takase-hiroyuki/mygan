// utils.js

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
    "ＣＦ", "娯楽", "好機", "寄付", "好機", "ＣＦ", "好機", "娯楽",
    "好機", "子供", "好機", "ＣＦ", "市場", "好機", "娯楽", "好機",
    "寄付", "好機", "ＣＦ", "好機", "解雇", "好機", "市場", "好機"
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
