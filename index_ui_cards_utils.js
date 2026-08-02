// index_ui_cards_utils.js
import { roomId } from './common_config.js';
import { DOM_SELECTORS } from './common_dom_selectors.js';

export const SEL_G = DOM_SELECTORS.GUEST;
export const CELLS_OPPORTUNITY = [2, 4, 6, 8, 10, 13, 15, 17, 19, 21, 23];
export const CELLS_DOODAD = [1, 7, 14];
export const CELLS_MARKET = [12, 22];
export const CELLS_CHARITY = [3, 16];
export const CELLS_DOWNSIZED = [20];

export function getLocalPlayerName() {
    const nameEl = document.getElementById(SEL_G.STATUS.NAME);
    return (nameEl && nameEl.textContent !== '未定') ? nameEl.textContent : 'プレイヤー';
}

export async function broadcastError(supabase, target, message) {
    try {
        await supabase.from('game_logs').insert([{
            room_id: roomId,
            target: target,
            title: 'エラー',
            body: message
        }]);
    } catch (err) {
        console.error("エラーログ保存失敗:", err);
    }
}

console.log("【デバッグ】index_ui_cards_utils.js が読み込まれました。");
