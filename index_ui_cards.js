// index_ui_cards.js
import { roomId } from './common_config.js';
import { DOM_SELECTORS } from './common_dom_selectors.js';
import { setButtonActive, setMultipleButtonsActive, callRpcWithDebug } from './common_utils.js';

const SEL_G = DOM_SELECTORS.GUEST;

const CELLS_OPPORTUNITY = [2, 4, 6, 8, 10, 13, 15, 17, 19, 21, 23];
const CELLS_DOODAD = [1, 7, 14];
const CELLS_MARKET = [12, 22];
const CELLS_CHARITY = [3, 16];
const CELLS_DOWNSIZED = [20];

function getLocalPlayerName() {
    const nameEl = document.getElementById(SEL_G.STATUS.NAME);
    return (nameEl && nameEl.textContent !== '未定') ? nameEl.textContent : 'プレイヤー';
}

// エラー通知をローカルで処理せず、game_logs経由で全員に配信する関数
async function broadcastError(supabase, target, message) {
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

export function updateCardPhaseUI(position, flags = {}, currentCard = null, playerName = "現在のプレイヤー") {
    const drawButtons = [
        SEL_G.CARD.BTN_DRAW_SMALL_DEAL,
        SEL_G.CARD.BTN_DRAW_BIG_DEAL,
        SEL_G.CARD.BTN_DRAW_MARKET,
        SEL_G.CARD.BTN_DRAW_DOODAD,
        SEL_G.CARD.BTN_ACTION_DONATE,
        SEL_G.CARD.BTN_ACTION_DOWNSIZED
    ];
    const actionButtons = [
        SEL_G.CARD.BTN_BUY_REALESTATE,
        SEL_G.CARD.BTN_BUY_STOCK,
        SEL_G.CARD.BTN_SELL_STOCK,
        SEL_G.CARD.BTN_PASS,
        SEL_G.CARD.BTN_EXECUTE_PAYMENT 
    ];
    
    setMultipleButtonsActive(drawButtons, false);
    setMultipleButtonsActive(actionButtons, false);

    // ==========================================
    // マイナスキャッシュフロー時の強制支払いフェーズ
    // ==========================================
    if (flags.is_negative_cash_flow) {
        setButtonActive(SEL_G.CARD.BTN_EXECUTE_PAYMENT, true);
        return;
    }

    if (flags.is_action_completed) {
        return;
    }

    if (flags.is_card_drawn) {
        if (CELLS_OPPORTUNITY.includes(position)) {
            setButtonActive(SEL_G.CARD.BTN_BUY_STOCK, true);
            setButtonActive(SEL_G.CARD.BTN_BUY_REALESTATE, true);
            setButtonActive(SEL_G.CARD.BTN_PASS, true);
        } else if (CELLS_MARKET.includes(position)) {
            setButtonActive(SEL_G.CARD.BTN_SELL_STOCK, true);
            setButtonActive(SEL_G.CARD.BTN_PASS, true);
        } else if (CELLS_DOODAD.includes(position)) {
            setButtonActive(SEL_G.CARD.BTN_EXECUTE_PAYMENT, true);
        }
        return;
    }

    if (CELLS_OPPORTUNITY.includes(position)) {
        setButtonActive(SEL_G.CARD.BTN_DRAW_SMALL_DEAL, true);
        setButtonActive(SEL_G.CARD.BTN_DRAW_BIG_DEAL, true);
    } else if (CELLS_MARKET.includes(position)) {
        setButtonActive(SEL_G.CARD.BTN_DRAW_MARKET, true);
    } else if (CELLS_DOODAD.includes(position)) {
        setButtonActive(SEL_G.CARD.BTN_DRAW_DOODAD, true);
    } else if (CELLS_CHARITY.includes(position)) {
        setButtonActive(SEL_G.CARD.BTN_EXECUTE_PAYMENT, true);
    } else if (CELLS_DOWNSIZED.includes(position)) {
        setButtonActive(SEL_G.CARD.BTN_ACTION_DOWNSIZED, true);
    }
}

export async function executeGenericPayment(supabase, currentUserId, amountStr) {
    const playerName = getLocalPlayerName();
    const inputAmount = parseInt(amountStr.replace(/,/g, ''), 10);

    if (isNaN(inputAmount) || inputAmount < 0) {
        await broadcastError(supabase, playerName, "金額が一致しません。入力しなおしてください。");
        return;
    }

    // プレイヤーと部屋の最新状態を取得
    const { data: userData, error: userError } = await supabase.from('participants').select('state').eq('user_id', currentUserId).single();
    const { data: roomData, error: roomError } = await supabase.from('rooms').select('game_state').eq('id', roomId).single();

    if (userError || roomError || !userData || !roomData) {
        await broadcastError(supabase, playerName, "データの取得に失敗しました。");
        return;
    }

    const state = userData.state;
    const position = state.position;
    const flags = state.flags || {};
    const cash = state.financials?.cash || 0;
    const currentCard = roomData.game_state?.current_card;

    const btn = document.getElementById(SEL_G.CARD.BTN_EXECUTE_PAYMENT);

    // ==========================================
    // ケース4: マイナスキャッシュフローの支払い判定
    // ==========================================
    if (flags.is_negative_cash_flow) {
        const netCashFlow = state.financials?.net_cash_flow || 0;
        const expectedAmount = Math.abs(netCashFlow); // マイナス分を絶対値で取得

        if (inputAmount !== expectedAmount) {
            await broadcastError(supabase, playerName, "金額が一致しません。入力しなおしてください。");
            return;
        }

        if (cash < expectedAmount) {
            await broadcastError(supabase, playerName, "銀行ローンを組みなさい。");
            return;
        }

        if (btn) btn.disabled = true;
        try {
            // ※サーバー側の決済RPCの名称に合わせて調整してください（仮: action_pay_negative_cashflow_v2）
            const result = await callRpcWithDebug(supabase, 'action_pay_negative_cashflow_v2', {
                p_room_id: roomId,
                p_user_id: currentUserId
            });
            
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

    // ==========================================
    // ケース1: Doodad（無駄遣い）の支払い判定
    // ==========================================
    if (CELLS_DOODAD.includes(position) && flags.is_card_drawn && !flags.is_action_completed) {
        if (!currentCard || currentCard.deck_type !== 'doodad') {
            await broadcastError(supabase, playerName, "Doodadカード情報が見つかりません。");
            return;
        }

        const expectedAmount = currentCard.cost;

        if (inputAmount !== expectedAmount) {
            await broadcastError(supabase, playerName, "金額が一致しません。入力しなおしてください。");
            return;
        }

        if (cash < expectedAmount) {
            await broadcastError(supabase, playerName, "銀行ローンを組みなさい。");
            return;
        }

        if (btn) btn.disabled = true;
        try {
            const result = await callRpcWithDebug(supabase, 'action_pay_doodad_v2', {
                p_room_id: roomId,
                p_user_id: currentUserId
            });
            
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

    // ==========================================
    // ケース2: 解雇（Downsized）の支払い判定
    // ==========================================
    if (CELLS_DOWNSIZED.includes(position) && !flags.is_action_completed) {
        const totalExpenses = state.financials?.total_expenses || 0;
        const expectedAmount = totalExpenses * 3;

        if (inputAmount !== expectedAmount) {
            await broadcastError(supabase, playerName, "金額が一致しません。入力しなおしてください。");
            return;
        }

        if (cash < expectedAmount) {
            await broadcastError(supabase, playerName, "銀行ローンを組みなさい。");
            return;
        }

        if (btn) btn.disabled = true;
        try {
            const result = await callRpcWithDebug(supabase, 'action_land_on_downsized_v2', {
                p_room_id: roomId,
                p_user_id: currentUserId
            });
            
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

    // ==========================================
    // ケース3: 寄付（Charity）の支払い判定
    // ==========================================
    if (CELLS_CHARITY.includes(position) && !flags.is_action_completed) {
        const totalIncome = state.financials?.total_income || 0;
        const expectedAmount = Math.floor(totalIncome * 0.1);

        if (inputAmount !== expectedAmount) {
            await broadcastError(supabase, playerName, "金額が一致しません。入力しなおしてください。");
            return;
        }

        if (cash < expectedAmount) {
            await broadcastError(supabase, playerName, "銀行ローンを組みなさい。");
            return;
        }

        if (btn) btn.disabled = true;
        try {
            const result = await callRpcWithDebug(supabase, 'action_donate_charity_v2', {
                p_room_id: roomId,
                p_user_id: currentUserId
            });
            
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

export function initCardEventListeners(supabase, currentUserId) {
    const drawCardRpc = async (event) => {
        const btn = event.currentTarget;
        if (btn) btn.disabled = true;
        const playerName = getLocalPlayerName();
        const btnId = btn.id;

        let rpcName = 'draw_card_v2'; 

        if (btnId === SEL_G.CARD.BTN_DRAW_SMALL_DEAL) {
            rpcName = 'action_draw_small_deal_v2';
        } else if (btnId === SEL_G.CARD.BTN_DRAW_BIG_DEAL) {
            rpcName = 'action_draw_big_deal_v2';
        } else if (btnId === SEL_G.CARD.BTN_DRAW_MARKET) {
            rpcName = 'action_draw_market_v2';
        } else if (btnId === SEL_G.CARD.BTN_DRAW_DOODAD) {
            rpcName = 'action_draw_doodad_v2';
        }
        
        try {
            const result = await callRpcWithDebug(supabase, rpcName, {
                p_room_id: roomId,
                p_user_id: currentUserId
            });

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
            const result = await callRpcWithDebug(supabase, 'complete_card_action_v2', {
                p_room_id: roomId,
                p_user_id: currentUserId
            });

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

            const totalIncome = data.state?.financials?.total_income || 0;
            const expectedAmount = Math.floor(totalIncome * 0.1);

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

            const totalExpenses = data.state?.financials?.total_expenses || 0;
            const expectedAmount = totalExpenses * 3;

            await broadcastError(supabase, playerName, `解雇されたため、生活費3か月分として $${expectedAmount} を支払って下さい。`);
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

console.log("[デバッグ] index_ui_cards.js が正常にロードされました。");
