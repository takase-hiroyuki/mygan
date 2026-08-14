// index_actions_trade.js
import { roomId } from './common_config.js';
import { SEL_G } from './common_dom_selectors.js';
import { callRpcWithDebug, getLocalPlayerName, writeLog, sendGameProgressMessage } from './common_utils.js';

export async function actionProposeTrade(supabase, currentUserId) {
    if (!supabase || !currentUserId) return { error: "無効なリクエスト" };

    const elTarget = document.getElementById(SEL_G.TRADE.SELECT_TARGET);
    const elPrice = document.getElementById(SEL_G.TRADE.INPUT_PRICE);
    const playerName = getLocalPlayerName();
    
    if (!elTarget || !elPrice) {
        sendGameProgressMessage(supabase, roomId, playerName, "DOM要素が見つかりません", "actionProposeTrade");
        return { error: "DOM要素が見つかりません" };
    }

    const targetUserId = elTarget.value;
    const targetName = elTarget.options[elTarget.selectedIndex]?.text || "他のプレイヤー";
    const priceStr = elPrice.value;
    const priceYen = parseInt(priceStr, 10);

    if (!targetUserId) {
        sendGameProgressMessage(supabase, roomId, playerName, "交渉相手を選択してください。", "actionProposeTrade");
        return { error: "交渉相手を選択してください。" };
    }

    if (isNaN(priceYen) || priceYen < 0) {
        sendGameProgressMessage(supabase, roomId, playerName, "有効な金額を入力してください。", "actionProposeTrade");
        return { error: "有効な金額を入力してください。" };
    }

    if (priceYen < 160) {
        sendGameProgressMessage(supabase, roomId, playerName, "160円以上の金額を入力してください。", "actionProposeTrade");
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
        sendGameProgressMessage(supabase, roomId, playerName, `${targetName}と交渉中。返答待ちです`, "actionProposeTrade");
        return { success: true };
    } catch (error) {
        writeLog(supabase, playerName, "Error", `交渉エラー: ${error.message}`);
        sendGameProgressMessage(supabase, roomId, playerName, error.message, "actionProposeTrade");
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
        sendGameProgressMessage(supabase, roomId, playerName, "交渉成立。代金を支払い、カードを獲得しました。", "actionAcceptTrade");
        return { success: true };
    } catch (error) {
        writeLog(supabase, playerName, "Error", `承諾エラー: ${error.message}`);
        sendGameProgressMessage(supabase, roomId, playerName, error.message, "actionAcceptTrade");
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
        sendGameProgressMessage(supabase, roomId, playerName, "交渉を拒否しました。", "actionRejectTrade");
        return { success: true };
    } catch (error) {
        writeLog(supabase, playerName, "Error", `拒否エラー: ${error.message}`);
        sendGameProgressMessage(supabase, roomId, playerName, error.message, "actionRejectTrade");
        return { error: error.message };
    }
}

console.log("【残す】 index_actions_trade.js が正常にロードされました。");
