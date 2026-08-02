// index_ui_cards_payment.js
import { roomId } from './common_config.js';
import { callRpcWithDebug } from './common_utils.js';
import {
    SEL_G, CELLS_DOODAD, CELLS_DOWNSIZED, CELLS_CHARITY, getLocalPlayerName, broadcastError
} from './index_ui_cards_utils.js';

export async function executeGenericPayment(supabase, currentUserId, amountStr) {
    const playerName = getLocalPlayerName();
    const inputAmount = parseInt(amountStr.replace(/,/g, ''), 10);

    if (isNaN(inputAmount) || inputAmount < 0) {
        return await broadcastError(supabase, playerName, "金額が一致しません。入力しなおしてください。");
    }

    const { data: userData, error: userError } = await supabase.from('participants').select('state').eq('user_id', currentUserId).single();
    const { data: roomData, error: roomError } = await supabase.from('rooms').select('game_state').eq('id', roomId).single();
    if (userError || roomError || !userData || !roomData) {
        return await broadcastError(supabase, playerName, "データの取得に失敗しました。");
    }

    const state = userData.state;
    const position = state.position;
    const flags = state.flags || {};
    const cash = state.financials?.cash || 0;
    const currentCard = roomData.game_state?.current_card;
    const btn = document.getElementById(SEL_G.CARD.BTN_EXECUTE_PAYMENT);

    // マイナスキャッシュフローの支払い判定
    if (flags.is_negative_cash_flow) {
        const expectedAmount = Math.abs(state.financials?.net_cash_flow || 0);
        if (inputAmount !== expectedAmount) return await broadcastError(supabase, playerName, "金額が一致しません。入力しなおしてください。");
        if (cash < expectedAmount) return await broadcastError(supabase, playerName, "銀行ローンを組みなさい。");
        if (btn) btn.disabled = true;
        try {
            const result = await callRpcWithDebug(supabase, 'action_pay_negative_cashflow_v2', { p_room_id: roomId, p_user_id: currentUserId });
            if (result && result.status === 'error') {
                await broadcastError(supabase, playerName, `支払いエラー: ${result.message}`);
                if (btn) btn.disabled = false;
            } else {
                const inputEl = document.getElementById(SEL_G.CARD.INPUT_PAYMENT_AMOUNT);
                if (inputEl) inputEl.value = '';
            }
        } catch (error) {
            await broadcastError(supabase, playerName, `マイナスキャッシュフローの支払いに失敗しました: ${error.message}`);
            if (btn) btn.disabled = false;
        }
        return;
    }

    // Doodad（無駄遣い）の支払い判定
    if (CELLS_DOODAD.includes(position) && flags.is_card_drawn && !flags.is_action_completed) {
        if (!currentCard || currentCard.deck_type !== 'doodad') return await broadcastError(supabase, playerName, "Doodadカード情報が見つかりません。");
        const expectedAmount = currentCard.cost;
        if (inputAmount !== expectedAmount) return await broadcastError(supabase, playerName, "金額が一致しません。入力しなおしてください。");
        if (cash < expectedAmount) return await broadcastError(supabase, playerName, "銀行ローンを組みなさい。");
        if (btn) btn.disabled = true;
        try {
            const result = await callRpcWithDebug(supabase, 'action_pay_doodad_v2', { p_room_id: roomId, p_user_id: currentUserId });
            if (result && result.status === 'error') {
                await broadcastError(supabase, playerName, `支払いエラー: ${result.message}`);
                if (btn) btn.disabled = false;
            } else {
                const inputEl = document.getElementById(SEL_G.CARD.INPUT_PAYMENT_AMOUNT);
                if (inputEl) inputEl.value = '';
            }
        } catch (error) {
            await broadcastError(supabase, playerName, `支払いに失敗しました: ${error.message}`);
            if (btn) btn.disabled = false;
        }
        return;
    }

    // 解雇（Downsized）の支払い判定
    if (CELLS_DOWNSIZED.includes(position) && !flags.is_action_completed) {
        const expectedAmount = (state.financials?.total_expenses || 0) * 3;
        if (inputAmount !== expectedAmount) return await broadcastError(supabase, playerName, "金額が一致しません。入力しなおしてください。");
        if (cash < expectedAmount) return await broadcastError(supabase, playerName, "銀行ローンを組みなさい。");
        if (btn) btn.disabled = true;
        try {
            const result = await callRpcWithDebug(supabase, 'action_land_on_downsized_v2', { p_room_id: roomId, p_user_id: currentUserId });
            if (result && result.status === 'error') {
                await broadcastError(supabase, playerName, `解雇処理エラー: ${result.message}`);
                if (btn) btn.disabled = false;
            } else {
                const inputEl = document.getElementById(SEL_G.CARD.INPUT_PAYMENT_AMOUNT);
                if (inputEl) inputEl.value = '';
            }
        } catch (error) {
            await broadcastError(supabase, playerName, `解雇の支払いに失敗しました: ${error.message}`);
            if (btn) btn.disabled = false;
        }
        return;
    }

    // 寄付（Charity）の支払い判定
    if (CELLS_CHARITY.includes(position) && !flags.is_action_completed) {
        const expectedAmount = Math.floor((state.financials?.total_income || 0) * 0.1);
        if (inputAmount !== expectedAmount) return await broadcastError(supabase, playerName, "金額が一致しません。入力しなおしてください。");
        if (cash < expectedAmount) return await broadcastError(supabase, playerName, "銀行ローンを組みなさい。");
        if (btn) btn.disabled = true;
        try {
            const result = await callRpcWithDebug(supabase, 'action_donate_charity_v2', { p_room_id: roomId, p_user_id: currentUserId });
            if (result && result.status === 'error') {
                await broadcastError(supabase, playerName, `寄付処理エラー: ${result.message}`);
                if (btn) btn.disabled = false;
            } else {
                const inputEl = document.getElementById(SEL_G.CARD.INPUT_PAYMENT_AMOUNT);
                if (inputEl) inputEl.value = '';
            }
        } catch (error) {
            await broadcastError(supabase, playerName, `寄付の支払いに失敗しました: ${error.message}`);
            if (btn) btn.disabled = false;
        }
        return;
    }

    await broadcastError(supabase, playerName, "現在、実行可能な支払いアクションはありません。");
}

console.log("【デバッグ】index_ui_cards_payment.js が読み込まれました。");
