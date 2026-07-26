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

