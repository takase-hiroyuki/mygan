// index_actions_trade.js
import { roomId } from './common_config.js';
import { SEL_G } from './common_dom_selectors.js';
import { callRpcWithDebug, insertSystemMessage, getLocalPlayerName } from './common_utils.js';

export async function actionProposeTrade(supabase, currentUserId) {
    if (!supabase || !currentUserId) return;

    const elTarget = document.getElementById(SEL_G.TRADE.SELECT_TARGET);
    const elPrice = document.getElementById(SEL_G.TRADE.INPUT_PRICE);
    const elBtnSell = document.getElementById(SEL_G.TRADE.BTN_SELL);
    
    if (!elTarget || !elPrice) return;

    const targetUserId = elTarget.value;
    const priceStr = elPrice.value;
    const price = parseInt(priceStr, 10);
    const playerName = getLocalPlayerName();

    console.log("[DEBUG] actionProposeTrade 開始:", { targetUserId, price });

    // バリデーション（アラート禁止のためシステムメッセージで通知）
    if (!targetUserId) {
        await insertSystemMessage(supabase, playerName, "交渉相手を選択してください。");
        return;
    }

    if (isNaN(price) || price < 0) {
        await insertSystemMessage(supabase, playerName, "有効な金額を入力してください。");
        return;
    }

    // 連打防止のためボタンを一時的に無効化
    if (elBtnSell) elBtnSell.disabled = true;

    try {
        await callRpcWithDebug(supabase, 'propose_trade_v2', {
            p_room_id: roomId,
            p_seller_id: currentUserId,
            p_buyer_id: targetUserId,
            p_price: price
        });
        await insertSystemMessage(supabase, playerName, "交渉を持ちかけました。相手の返答を待っています。");
        console.log("[DEBUG] 交渉データの送信完了");
    } catch (error) {
        console.error("[DEBUG] 交渉エラー:", error);
        await insertSystemMessage(supabase, playerName, `交渉エラー: ${error.message}`);
        if (elBtnSell) elBtnSell.disabled = false;
    }
}

console.log("[デバッグ] index_actions_trade.js が正常にロードされました。");
