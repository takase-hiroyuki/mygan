// index_ui_cards_utils.js
import { SEL_G } from './common_dom_selectors.js';

export function getLocalPlayerName() {
    const nameEl = document.getElementById(SEL_G.STATUS.NAME);
    return (nameEl && nameEl.textContent !== '未定') ? nameEl.textContent : 'プレイヤー';
}

console.log("【デバッグ】index_ui_cards_utils.js が読み込まれました。");
