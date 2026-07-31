// index_ui_cards.js
import { roomId } from './common_config.js';
import { DOM_SELECTORS } from './common_dom_selectors.js';
import { setButtonActive, setMultipleButtonsActive, callRpcWithDebug } from './common_utils.js';

const SEL_G = DOM_SELECTORS.GUEST;

// ==========================================
// マスの種類ごとのインデックス定義
// ==========================================
const CELLS_OPPORTUNITY = [2, 4, 6, 8, 10, 13, 15, 17, 19, 21, 23];
const CELLS_DOODAD = [1, 7, 14];
const CELLS_MARKET = [12, 22];

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
        if (statusMessage) statusMessage.textContent = "カードアクション完了。ローン操作を行うか、手番を終了してください。";
        return; // ここで処理を終了
    }

    // ==========================================
    // 状態2: カードを引いた後（アクション選択中）の場合
    // ==========================================
    if (flags.is_card_drawn) {
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

    if (requireCardAction) {
        if (statusMessage) statusMessage.textContent = "カードを引いてください。アクション必須です。";
    } else {
        if (statusMessage) statusMessage.textContent = "現在場に出ているカードはありません。";
    }
}

/**
 * カードアクション関連のイベントリスナーを初期化する
 */
export function initCardEventListeners(supabase, currentUserId) {
    console.log("【デバッグ】initCardEventListeners");
    
    // カードを引く処理（二重送信防止UIロックを追加）
    const drawCardRpc = async (event) => {
        const btn = event.currentTarget;
        if (btn) btn.disabled = true;
        
        try {
            await callRpcWithDebug(supabase, 'draw_card', {
                p_room_id: roomId,
                p_user_id: currentUserId
            });
        } catch (error) {
            alert(`エラー: ${error.message}`);
            if (btn) btn.disabled = false; // エラー時はロック解除
        }
    };

    // Doodadの費用を支払う処理（新規追加・RPC経由）
    const payDoodadRpc = async (event) => {
        const btn = event.currentTarget;
        if (btn) btn.disabled = true;
        
        try {
            const result = await callRpcWithDebug(supabase, 'action_pay_doodad', {
                p_room_id: roomId,
                p_user_id: currentUserId
            });
            // 現金不足等の論理エラーを検知して通知
            if (result && result.status === 'error') {
                alert(result.message);
                if (btn) btn.disabled = false;
            }
        } catch (error) {
            alert(`エラー: ${error.message}`);
            if (btn) btn.disabled = false;
        }
    };

    // アクションの完了処理（RPC経由）
    const completeActionRpc = async (event) => {
        const btn = event.currentTarget;
        if (btn) btn.disabled = true;
        
        try {
            await callRpcWithDebug(supabase, 'complete_card_action', {
                p_room_id: roomId,
                p_user_id: currentUserId
            });
        } catch (error) {
            alert(`エラー: ${error.message}`);
            if (btn) btn.disabled = false;
        }
    };

    // リスナーの登録: カードを引く
    document.getElementById(SEL_G.CARD.BTN_DRAW_SMALL_DEAL)?.addEventListener('click', drawCardRpc);
    document.getElementById(SEL_G.CARD.BTN_DRAW_BIG_DEAL)?.addEventListener('click', drawCardRpc);
    document.getElementById(SEL_G.CARD.BTN_DRAW_MARKET)?.addEventListener('click', drawCardRpc);
    document.getElementById(SEL_G.CARD.BTN_DRAW_DOODAD)?.addEventListener('click', drawCardRpc);

    // リスナーの登録: 支払いアクション
    document.getElementById(SEL_G.CARD.BTN_PAY_DOODAD)?.addEventListener('click', payDoodadRpc);

    // リスナーの登録: アクション完了（パス等）
    document.getElementById(SEL_G.CARD.BTN_PASS)?.addEventListener('click', completeActionRpc);
    document.getElementById(SEL_G.CARD.BTN_BUY_STOCK)?.addEventListener('click', completeActionRpc);
    document.getElementById(SEL_G.CARD.BTN_BUY_REALESTATE)?.addEventListener('click', completeActionRpc);
    document.getElementById(SEL_G.CARD.BTN_SELL_STOCK)?.addEventListener('click', completeActionRpc);
}

console.log("【デバッグ】index_ui_cards.js が読み込まれました。");
