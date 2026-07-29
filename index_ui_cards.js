// index_ui_cards.js
import { roomId } from './common_config.js'; // 追加: RPCの呼び出しに必要
import { DOM_SELECTORS } from './common_dom_selectors.js';
import { setButtonActive, setMultipleButtonsActive, callRpcWithDebug } from './common_utils.js'; // ★ callRpcWithDebug を追加

const SEL_G = DOM_SELECTORS.GUEST;

// ==========================================
// マスの種類ごとのインデックス定義
// ==========================================
const CELLS_OPPORTUNITY = [2, 4, 6, 8, 10, 13, 15, 17, 19, 21, 23];
const CELLS_DOODAD = [1, 7, 14];
const CELLS_MARKET = [12, 22];

/**
 * フラグをデータベースに直接保存するローカルヘルパー関数
 * ※ 次のステップでアクション完了処理をRPC化するまで、一時的に維持します。
 */
async function updateCardFlag(supabase, userId, flagName, value) {
    if (!supabase || !userId) return;
    const { data, error } = await supabase.from('participants').select('state').eq('user_id', userId).single();
    if (error || !data) return;
    
    const newState = { ...data.state };
    newState.flags = newState.flags || {};
    newState.flags[flagName] = value;
    await supabase.from('participants').update({ state: newState }).eq('user_id', userId);
}

/**
 * 現在地とフラグ状態に応じてカードフェーズのUIを切り替える
 * ※ index_ui.js から盤面移動直後や同期時に呼び出される
 */
export function updateCardPhaseUI(position, flags = {}) {
    console.log("【デバッグ】updateCardPhaseUI", flags);
    const drawButtons = [
        SEL_G.CARD.BTN_DRAW_SMALL_DEAL,
        SEL_G.CARD.BTN_DRAW_BIG_DEAL,
        SEL_G.CARD.BTN_DRAW_MARKET,
        SEL_G.CARD.BTN_DRAW_DOODAD
    ];
    const actionButtons = [
        SEL_G.CARD.BTN_BUY_REALESTATE,
        SEL_G.CARD.BTN_BUY_STOCK,
        SEL_G.CARD.BTN_SELL_STOCK,
        SEL_G.CARD.BTN_PAY_DOODAD,
        SEL_G.CARD.BTN_PASS
    ];
    
    // 全てのカード関連ボタンを一旦リセット
    setMultipleButtonsActive(drawButtons, false);
    setMultipleButtonsActive(actionButtons, false);

    const statusMessage = document.getElementById(SEL_G.CARD.STATUS_MESSAGE);

    // ==========================================
    // 状態1: 既にアクションを完了している場合
    // ==========================================
    if (flags.is_action_completed) {
        setButtonActive(SEL_G.CONTROLS.BTN_END_TURN, true);
        if (statusMessage) statusMessage.textContent = "カードアクション完了。ローン操作を行うか、手番を終了してください。";
        return; // ここで処理を終了し、これ以上ボタンを触らない
    }

    // ==========================================
    // 状態2: カードを引いた後（アクション選択中）の場合
    // ==========================================
    if (flags.is_card_drawn) {
        setButtonActive(SEL_G.CONTROLS.BTN_END_TURN, false); // アクションが完了するまで手番終了はロック

        if (CELLS_OPPORTUNITY.includes(position)) {
            setButtonActive(SEL_G.CARD.BTN_BUY_STOCK, true);
            setButtonActive(SEL_G.CARD.BTN_BUY_REALESTATE, true);
            setButtonActive(SEL_G.CARD.BTN_PASS, true);
            if (statusMessage) statusMessage.textContent = "ディールカードを引きました。購入するか、パスしてください。";
        } else if (CELLS_MARKET.includes(position)) {
            setButtonActive(SEL_G.CARD.BTN_SELL_STOCK, true);
            setButtonActive(SEL_G.CARD.BTN_PASS, true);
            if (statusMessage) statusMessage.textContent = "マーケットカードを引きました。売却するか、パスしてください。";
        } else if (CELLS_DOODAD.includes(position)) {
            setButtonActive(SEL_G.CARD.BTN_PAY_DOODAD, true);
            if (statusMessage) statusMessage.textContent = "Doodadカードを引きました。必ず費用を支払ってください。";
        }
        return; // ここで処理を終了
    }

    // ==========================================
    // 状態3: まだカードを引いていない初期状態
    // ==========================================
    let requireCardAction = false;

    if (CELLS_OPPORTUNITY.includes(position)) {
        setButtonActive(SEL_G.CARD.BTN_DRAW_SMALL_DEAL, true);
        setButtonActive(SEL_G.CARD.BTN_DRAW_BIG_DEAL, true);
        requireCardAction = true;
    } else if (CELLS_MARKET.includes(position)) {
        setButtonActive(SEL_G.CARD.BTN_DRAW_MARKET, true);
        requireCardAction = true;
    } else if (CELLS_DOODAD.includes(position)) {
        setButtonActive(SEL_G.CARD.BTN_DRAW_DOODAD, true);
        requireCardAction = true;
    }

    // アクション必須マスに止まった場合は手番終了をロック
    if (requireCardAction) {
        setButtonActive(SEL_G.CONTROLS.BTN_END_TURN, false);
        if (statusMessage) statusMessage.textContent = "カードを引いてください。アクション必須";
    } else {
        if (statusMessage) statusMessage.textContent = "現在場に出ているカードはありません。";
    }
}

/**
 * カードアクション関連のイベントリスナーを初期化する
 */
export function initCardEventListeners(supabase, currentUserId) {
    console.log("【デバッグ】initCardEventListeners");
    const drawCardRpc = async () => {
        try {
            // ★修正: callRpcWithDebug ラッパーを使用
            await callRpcWithDebug(supabase, 'draw_card', {
                p_room_id: roomId,
                p_user_id: currentUserId
            });
        } catch (error) {
            alert(`エラー: ${error.message}`);
        }
    };

    document.getElementById(SEL_G.CARD.BTN_DRAW_SMALL_DEAL)?.addEventListener('click', drawCardRpc);
    document.getElementById(SEL_G.CARD.BTN_DRAW_BIG_DEAL)?.addEventListener('click', drawCardRpc);
    document.getElementById(SEL_G.CARD.BTN_DRAW_MARKET)?.addEventListener('click', drawCardRpc);
    document.getElementById(SEL_G.CARD.BTN_DRAW_DOODAD)?.addEventListener('click', drawCardRpc);

    // --- 【維持】アクションの完了（購入、支払い、パスなど） ---
    const resetCardUI = async () => {
        await updateCardFlag(supabase, currentUserId, 'is_action_completed', true);
    };

    document.getElementById(SEL_G.CARD.BTN_PASS)?.addEventListener('click', resetCardUI);
    document.getElementById(SEL_G.CARD.BTN_BUY_STOCK)?.addEventListener('click', resetCardUI);
    document.getElementById(SEL_G.CARD.BTN_BUY_REALESTATE)?.addEventListener('click', resetCardUI);
    document.getElementById(SEL_G.CARD.BTN_SELL_STOCK)?.addEventListener('click', resetCardUI);
    document.getElementById(SEL_G.CARD.BTN_PAY_DOODAD)?.addEventListener('click', resetCardUI);
}

console.log("【デバッグ】index_ui_cards.js が読み込まれました。");
