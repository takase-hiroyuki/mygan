// index_ui_cards_events.js
import { roomId } from './common_config.js';
import { callRpcWithDebug, setButtonActive } from './common_utils.js';
import { SEL_G, getLocalPlayerName, broadcastError } from './index_ui_cards_utils.js';

export function initCardEventListeners(supabase, currentUserId) {
    const drawCardRpc = async (event) => {
        const btn = event.currentTarget;
        if (btn) btn.disabled = true;
        const playerName = getLocalPlayerName();
        const btnId = btn.id;

        let rpcName = 'draw_card_v2'; 
        if (btnId === SEL_G.CARD.BTN_DRAW_SMALL_DEAL) rpcName = 'action_draw_small_deal_v2';
        else if (btnId === SEL_G.CARD.BTN_DRAW_BIG_DEAL) rpcName = 'action_draw_big_deal_v2';
        else if (btnId === SEL_G.CARD.BTN_DRAW_MARKET) rpcName = 'action_draw_market_v2';
        else if (btnId === SEL_G.CARD.BTN_DRAW_DOODAD) rpcName = 'action_draw_doodad_v2';
        
        try {
            const result = await callRpcWithDebug(supabase, rpcName, { p_room_id: roomId, p_user_id: currentUserId });
            if (result && result.status === 'error') {
                await broadcastError(supabase, playerName, result.message);
                if (btn) btn.disabled = false;
            }
        } catch (error) {
            await broadcastError(supabase, playerName, `カードを引く処理に失敗しました: ${error.message}`);
            if (btn) btn.disabled = false;
        }
    };

    const completeActionRpc = async (event) => {
        const btn = event.currentTarget;
        if (btn) btn.disabled = true;
        const playerName = getLocalPlayerName();
        try {
            const result = await callRpcWithDebug(supabase, 'complete_card_action_v2', { p_room_id: roomId, p_user_id: currentUserId });
            if (result && result.status === 'error') {
                await broadcastError(supabase, playerName, result.message);
                if (btn) btn.disabled = false;
            }
        } catch (error) {
            await broadcastError(supabase, playerName, `アクションの完了に失敗しました: ${error.message}`);
            if (btn) btn.disabled = false;
        }
    };

    const donateRpc = async (event) => {
        const btn = event.currentTarget;
        if (btn) btn.disabled = true;
        const playerName = getLocalPlayerName();
        try {
            const { data, error } = await supabase.from('participants').select('state').eq('user_id', currentUserId).single();
            if (error || !data) {
                await broadcastError(supabase, playerName, "データの取得に失敗しました。");
                if (btn) btn.disabled = false;
                return;
            }
            const expectedAmount = Math.floor((data.state?.financials?.total_income || 0) * 0.1);
            await broadcastError(supabase, playerName, `寄付をするため、総収入の10%にあたる $${expectedAmount} を支払って下さい。`);
            setButtonActive(SEL_G.CARD.BTN_EXECUTE_PAYMENT, true);
        } catch (error) {
            await broadcastError(supabase, playerName, `寄付処理エラー: ${error.message}`);
            if (btn) btn.disabled = false;
        }
    };

    const downsizedRpc = async (event) => {
        const btn = event.currentTarget;
        if (btn) btn.disabled = true;
        const playerName = getLocalPlayerName();
        try {
            const { data, error } = await supabase.from('participants').select('state').eq('user_id', currentUserId).single();
            if (error || !data) {
                await broadcastError(supabase, playerName, "データの取得に失敗しました。");
                if (btn) btn.disabled = false;
                return;
            }
            const expectedAmount = (data.state?.financials?.total_expenses || 0);
            await broadcastError(supabase, playerName, `解雇されました。生活費3か月分 $${expectedAmount} を支払います。`);
            setButtonActive(SEL_G.CARD.BTN_EXECUTE_PAYMENT, true);
        } catch (error) {
            await broadcastError(supabase, playerName, `解雇処理エラー: ${error.message}`);
            if (btn) btn.disabled = false;
        }
    };

    document.getElementById(SEL_G.CARD.BTN_DRAW_SMALL_DEAL)?.addEventListener('click', drawCardRpc);
    document.getElementById(SEL_G.CARD.BTN_DRAW_BIG_DEAL)?.addEventListener('click', drawCardRpc);
    document.getElementById(SEL_G.CARD.BTN_DRAW_MARKET)?.addEventListener('click', drawCardRpc);
    document.getElementById(SEL_G.CARD.BTN_DRAW_DOODAD)?.addEventListener('click', drawCardRpc);
    document.getElementById(SEL_G.CARD.BTN_ACTION_DONATE)?.addEventListener('click', donateRpc);
    document.getElementById(SEL_G.CARD.BTN_ACTION_DOWNSIZED)?.addEventListener('click', downsizedRpc);
    document.getElementById(SEL_G.CARD.BTN_PASS)?.addEventListener('click', completeActionRpc);
    document.getElementById(SEL_G.CARD.BTN_BUY_STOCK)?.addEventListener('click', completeActionRpc);
    document.getElementById(SEL_G.CARD.BTN_BUY_REALESTATE)?.addEventListener('click', completeActionRpc);
    document.getElementById(SEL_G.CARD.BTN_SELL_STOCK)?.addEventListener('click', completeActionRpc);
}

console.log("【デバッグ】index_ui_cards_events.js が読み込まれました。");
