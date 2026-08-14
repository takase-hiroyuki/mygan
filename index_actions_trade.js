// index_actions_trade.js
import { roomId } from './common_config.js';
import { SEL_G } from './common_dom_selectors.js';
import { callRpcWithDebug, sendGameProgressMessage, getLocalPlayerName, writeLog } from './common_utils.js';

export async function actionProposeTrade(supabase, currentUserId) {
    if (!supabase || !currentUserId) return;

    const elTarget = document.getElementById(SEL_G.TRADE.SELECT_TARGET);
    const elPrice = document.getElementById(SEL_G.TRADE.INPUT_PRICE);
    const elBtnSell = document.getElementById(SEL_G.TRADE.BTN_SELL);
    
    if (!elTarget || !elPrice) return;

    const targetUserId = elTarget.value;
    const priceStr = elPrice.value;
    const priceYen = parseInt(priceStr, 10);
    const playerName = getLocalPlayerName();

    console.log("[DEBUG] actionProposeTrade 開始:", { targetUserId, priceYen });

    if (!targetUserId) {
        sendGameProgressMessage(supabase, roomId, playerName, "交渉相手を選択してください。", "actionProposeTrade");
        return;
    }

    if (isNaN(priceYen) || priceYen < 0) {
        sendGameProgressMessage(supabase, roomId, playerName, "有効な金額を入力してください。", "actionProposeTrade");
        return;
    }

    if (priceYen < 160) {
        sendGameProgressMessage(supabase, roomId, playerName, "160円以上の金額を入力してください。", "actionProposeTrade");
        return;
    }

    const priceUsd = Math.floor(priceYen / 160);

    if (elBtnSell) elBtnSell.disabled = true;

    try {
        await callRpcWithDebug(supabase, 'propose_trade_v2', {
            p_room_id: roomId,
            p_seller_id: currentUserId,
            p_buyer_id: targetUserId,
            p_price: priceUsd
        });
        sendGameProgressMessage(supabase, roomId, playerName, "交渉を持ちかけました。相手の返答を待っています。", "actionProposeTrade");
        console.log("[DEBUG] 交渉データの送信完了");
    } catch (error) {
        console.error("[DEBUG] 交渉エラー:", error);
        writeLog(supabase, playerName, "Error", `交渉エラー: ${error.message}`);
    } finally {
        if (elBtnSell) elBtnSell.disabled = false;
    }
}

export async function actionAcceptTrade(supabase, currentUserId) {
    if (!supabase || !currentUserId) return;
    const playerName = getLocalPlayerName();
    const btnAccept = document.getElementById(SEL_G.TRADE.BTN_ACCEPT);
    const btnReject = document.getElementById(SEL_G.TRADE.BTN_REJECT);

    if (btnAccept) btnAccept.disabled = true;
    if (btnReject) btnReject.disabled = true;

    try {
        await callRpcWithDebug(supabase, 'accept_trade_v2', {
            p_room_id: roomId,
            p_buyer_id: currentUserId
        });
        sendGameProgressMessage(supabase, roomId, playerName, "交渉を承諾し、代金を支払いました。カードの権利を取得しました。", "actionAcceptTrade");
    } catch (error) {
        writeLog(supabase, playerName, "Error", `承諾エラー: ${error.message}`);
    } finally {
        if (btnAccept) btnAccept.disabled = false;
        if (btnReject) btnReject.disabled = false;
    }
}

export async function actionRejectTrade(supabase, currentUserId) {
    if (!supabase || !currentUserId) return;
    const playerName = getLocalPlayerName();
    const btnAccept = document.getElementById(SEL_G.TRADE.BTN_ACCEPT);
    const btnReject = document.getElementById(SEL_G.TRADE.BTN_REJECT);

    if (btnAccept) btnAccept.disabled = true;
    if (btnReject) btnReject.disabled = true;

    try {
        await callRpcWithDebug(supabase, 'clear_trade_v2', {
            p_room_id: roomId
        });
        sendGameProgressMessage(supabase, roomId, playerName, "交渉を拒否しました。", "actionRejectTrade");
    } catch (error) {
        writeLog(supabase, playerName, "Error", `拒否エラー: ${error.message}`);
    } finally {
        if (btnAccept) btnAccept.disabled = false;
        if (btnReject) btnReject.disabled = false;
    }
}

export async function actionProcessSelf(supabase, currentUserId) {
    if (!supabase || !currentUserId) return;
    const playerName = getLocalPlayerName();
    
    const elBtnProcess = document.getElementById(SEL_G.TRADE.BTN_PROCESS_SELF);
    const elNumProcess = document.getElementById(SEL_G.TRADE.NUM_PROCESS_SELF);
    
    let quantity = 1;
    
    if (elNumProcess && !elNumProcess.hidden && elNumProcess.value) {
        quantity = parseInt(elNumProcess.value, 10);
        if (isNaN(quantity) || quantity <= 0) {
            sendGameProgressMessage(supabase, roomId, playerName, "有効な数量を入力してください。", "actionProcessSelf");
            return;
        }
    }

    if (elBtnProcess) elBtnProcess.disabled = true;

    try {
        await callRpcWithDebug(supabase, 'execute_drawn_card_v2', {
            p_room_id: roomId,
            p_user_id: currentUserId,
            p_input_quantity: quantity
        });
        sendGameProgressMessage(supabase, roomId, playerName, "カードを処理しました。", "actionProcessSelf");
        
        if (elNumProcess) elNumProcess.value = '';
    } catch (error) {
        writeLog(supabase, playerName, "Error", `処理エラー: ${error.message}`);
    } finally {
        if (elBtnProcess) elBtnProcess.disabled = false;
    }
}

console.log("【残す】 index_actions_trade.js が正常にロードされました。");
