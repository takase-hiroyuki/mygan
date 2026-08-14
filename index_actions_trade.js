// index_actions_trade.js
import { roomId } from './common_config.js';
import { SEL_G } from './common_dom_selectors.js';
import { callRpcWithDebug, getLocalPlayerName, writeLog } from './common_utils.js';

export async function actionProposeTrade(supabase, currentUserId) {
    if (!supabase || !currentUserId) return { error: "無効なリクエスト" };

    const elTarget = document.getElementById(SEL_G.TRADE.SELECT_TARGET);
    const elPrice = document.getElementById(SEL_G.TRADE.INPUT_PRICE);
    
    if (!elTarget || !elPrice) return { error: "DOM要素が見つかりません" };

    const targetUserId = elTarget.value;
    const priceStr = elPrice.value;
    const priceYen = parseInt(priceStr, 10);
    const playerName = getLocalPlayerName();

    console.log("[DEBUG] actionProposeTrade 開始:", { targetUserId, priceYen });

    if (!targetUserId) {
        return { error: "交渉相手を選択してください。" };
    }

    if (isNaN(priceYen) || priceYen < 0) {
        return { error: "有効な金額を入力してください。" };
    }

    if (priceYen < 160) {
        return { error: "160円以上の金額を入力してください。" };
    }

    const priceUsd = Math.floor(priceYen / 160);

    try {
        await callRpcWithDebug(supabase, 'propose_trade_v2', {
            p_room_id: roomId,
            p_seller_id: currentUserId,
            p_buyer_id: targetUserId,
            p_price: priceUsd
        });
        console.log("[DEBUG] 交渉データの送信完了");
        return { success: true };
    } catch (error) {
        console.error("[DEBUG] 交渉エラー:", error);
        writeLog(supabase, playerName, "Error", `交渉エラー: ${error.message}`);
        return { error: error.message };
    }
}

export async function actionAcceptTrade(supabase, currentUserId) {
    if (!supabase || !currentUserId) return { error: "無効なリクエスト" };
    const playerName = getLocalPlayerName();

    try {
        await callRpcWithDebug(supabase, 'accept_trade_v2', {
            p_room_id: roomId,
            p_buyer_id: currentUserId
        });
        return { success: true };
    } catch (error) {
        writeLog(supabase, playerName, "Error", `承諾エラー: ${error.message}`);
        return { error: error.message };
    }
}

export async function actionRejectTrade(supabase, currentUserId) {
    if (!supabase || !currentUserId) return { error: "無効なリクエスト" };
    const playerName = getLocalPlayerName();

    try {
        await callRpcWithDebug(supabase, 'clear_trade_v2', {
            p_room_id: roomId
        });
        return { success: true };
    } catch (error) {
        writeLog(supabase, playerName, "Error", `拒否エラー: ${error.message}`);
        return { error: error.message };
    }
}

export async function actionProcessSelf(supabase, currentUserId) {
    if (!supabase || !currentUserId) return { error: "無効なリクエスト" };
    const playerName = getLocalPlayerName();
    
    const elNumProcess = document.getElementById(SEL_G.TRADE.NUM_PROCESS_SELF);
    let quantity = 1;
    
    if (elNumProcess && !elNumProcess.hidden && elNumProcess.value) {
        quantity = parseInt(elNumProcess.value, 10);
        if (isNaN(quantity) || quantity <= 0) {
            return { error: "有効な数量を入力してください。" };
        }
    }

    try {
        await callRpcWithDebug(supabase, 'execute_drawn_card_v2', {
            p_room_id: roomId,
            p_user_id: currentUserId,
            p_input_quantity: quantity
        });
        return { success: true };
    } catch (error) {
        writeLog(supabase, playerName, "Error", `処理エラー: ${error.message}`);
        return { error: error.message };
    }
}

console.log("【残す】 index_actions_trade.js が正常にロードされました。");
