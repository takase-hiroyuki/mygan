// index_ui_cards.js
import { roomId } from './common_config.js';
import { DOM_SELECTORS } from './common_dom_selectors.js';
import { setButtonActive, setMultipleButtonsActive, callRpcWithDebug } from './common_utils.js';
import { displaySystemMessage } from './index_state.js';

const SEL_G = DOM_SELECTORS.GUEST;

// ==========================================
// マスの種類ごとのインデックス定義
// ==========================================
const CELLS_OPPORTUNITY = [2, 4, 6, 8, 10, 13, 15, 17, 19, 21, 23];
const CELLS_DOODAD = [1, 7, 14];
const CELLS_MARKET = [12, 22];
const CELLS_CHARITY = [3, 16];
const CELLS_DOWNSIZED = [20];

/**
 * 画面（DOM）から現在のプレイヤー名を取得するヘルパー関数
 */
function getLocalPlayerName() {
    const nameEl = document.getElementById(SEL_G.STATUS.NAME);
    return (nameEl && nameEl.textContent !== '未定') ? nameEl.textContent : 'プレイヤー';
}

/**
 * 現在地とフラグ状態に応じてカードフェーズのUIを切り替える
 * ※ index_ui.js から盤面移動直後や同期時に呼び出される
 */
export function updateCardPhaseUI(position, flags = {}, currentCard = null, playerName = "現在のプレイヤー") {
    console.log("【デバッグ】updateCardPhaseUI", flags);
    
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
        if (statusMessage) statusMessage.textContent = "アクション完了。ローン操作を行うか、手番を終了してください。";
        return;
    }

    // ==========================================
    // 状態2: カードを引いた後（アクション選択中）の場合
    // ==========================================
    if (flags.is_card_drawn) {
        let cardInfo = "";
        if (currentCard) {
            const costText = currentCard.cost ? `費用: $${currentCard.cost}` : (currentCard.down_payment ? `頭金: $${currentCard.down_payment}` : "");
            cardInfo = `「${currentCard.title}」${costText ? ` (${costText})` : ""}`;
        }

        if (CELLS_OPPORTUNITY.includes(position)) {
            setButtonActive(SEL_G.CARD.BTN_BUY_STOCK, true);
            setButtonActive(SEL_G.CARD.BTN_BUY_REALESTATE, true);
            setButtonActive(SEL_G.CARD.BTN_PASS, true);
            if (statusMessage) statusMessage.textContent = `${cardInfo}：購入するか、パスしてください。`;
        } else if (CELLS_MARKET.includes(position)) {
            setButtonActive(SEL_G.CARD.BTN_SELL_STOCK, true);
            setButtonActive(SEL_G.CARD.BTN_PASS, true);
            if (statusMessage) statusMessage.textContent = `${cardInfo}：売却するか、パスしてください。`;
        } else if (CELLS_DOODAD.includes(position)) {
            setButtonActive(SEL_G.CARD.BTN_PAY_DOODAD, true);
            if (statusMessage) statusMessage.textContent = `${cardInfo}：費用を支払ってください。`;
        }
        return;
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
    } else if (CELLS_CHARITY.includes(position)) {
        setButtonActive(SEL_G.CARD.BTN_ACTION_DONATE, true);
        requireCardAction = true;
    } else if (CELLS_DOWNSIZED.includes(position)) {
        setButtonActive(SEL_G.CARD.BTN_ACTION_DOWNSIZED, true);
        requireCardAction = true;
    }

    if (requireCardAction) {
        if (statusMessage) statusMessage.textContent = "アクションを選択してください。";
    } else {
        if (statusMessage) statusMessage.textContent = "現在場に出ているカードはありません。";
    }
}

/**
 * カードアクション関連のイベントリスナーを初期化する
 */
export function initCardEventListeners(supabase, currentUserId) {
    console.log("【デバッグ】initCardEventListeners");
    
    // カードを引く処理（各デッキに応じたRPCを呼び出す）
    const drawCardRpc = async (event) => {
        const btn = event.currentTarget;
        if (btn) btn.disabled = true;
        const playerName = getLocalPlayerName();
        const btnId = btn.id;

        let rpcName = 'draw_card_v2'; // デフォルト

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
                displaySystemMessage(playerName, "エラー", result.message);
                if (btn) btn.disabled = false;
            }
        } catch (error) {
            displaySystemMessage(playerName, "エラー", `カードを引く処理に失敗しました: ${error.message}`);
            if (btn) btn.disabled = false;
        }
    };

    // Doodadの費用を支払う処理
    const payDoodadRpc = async (event) => {
        const btn = event.currentTarget;
        if (btn) btn.disabled = true;
        const playerName = getLocalPlayerName();
        
        try {
            const result = await callRpcWithDebug(supabase, 'action_pay_doodad_v2', {
                p_room_id: roomId,
                p_user_id: currentUserId
            });
            
            if (result && result.status === 'error') {
                displaySystemMessage(playerName, "エラー", `支払いエラー: ${result.message}`);
                if (btn) btn.disabled = false;
            }
        } catch (error) {
            displaySystemMessage(playerName, "エラー", `支払いに失敗しました: ${error.message}`);
            if (btn) btn.disabled = false;
        }
    };

    // アクションの完了処理
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
                displaySystemMessage(playerName, "エラー", result.message);
                if (btn) btn.disabled = false;
            }
        } catch (error) {
            displaySystemMessage(playerName, "エラー", `アクションの完了に失敗しました: ${error.message}`);
            if (btn) btn.disabled = false;
        }
    };

    // 寄付ボタン処理
    const donateRpc = async (event) => {
        const btn = event.currentTarget;
        if (btn) btn.disabled = true;
        const playerName = getLocalPlayerName();
        
        try {
            const result = await callRpcWithDebug(supabase, 'action_donate_charity_v2', {
                p_room_id: roomId,
                p_user_id: currentUserId
            });
            
            if (result && result.status === 'error') {
                displaySystemMessage(playerName, "エラー", result.message);
                if (btn) btn.disabled = false;
            }
        } catch (error) {
            displaySystemMessage(playerName, "エラー", `寄付処理エラー: ${error.message}`);
            if (btn) btn.disabled = false;
        }
    };

    // 解雇ボタン処理
    const downsizedRpc = async (event) => {
        const btn = event.currentTarget;
        if (btn) btn.disabled = true;
        const playerName = getLocalPlayerName();
        
        try {
            const result = await callRpcWithDebug(supabase, 'action_land_on_downsized_v2', {
                p_room_id: roomId,
                p_user_id: currentUserId
            });
            
            if (result && result.status === 'error') {
                displaySystemMessage(playerName, "エラー", result.message);
                if (btn) btn.disabled = false;
            }
        } catch (error) {
            displaySystemMessage(playerName, "エラー", `解雇処理エラー: ${error.message}`);
            if (btn) btn.disabled = false;
        }
    };

    // リスナーの登録: カードを引く
    document.getElementById(SEL_G.CARD.BTN_DRAW_SMALL_DEAL)?.addEventListener('click', drawCardRpc);
    document.getElementById(SEL_G.CARD.BTN_DRAW_BIG_DEAL)?.addEventListener('click', drawCardRpc);
    document.getElementById(SEL_G.CARD.BTN_DRAW_MARKET)?.addEventListener('click', drawCardRpc);
    document.getElementById(SEL_G.CARD.BTN_DRAW_DOODAD)?.addEventListener('click', drawCardRpc);

    // リスナーの登録: 手動アクション（寄付・解雇）
    document.getElementById(SEL_G.CARD.BTN_ACTION_DONATE)?.addEventListener('click', donateRpc);
    document.getElementById(SEL_G.CARD.BTN_ACTION_DOWNSIZED)?.addEventListener('click', downsizedRpc);

    // リスナーの登録: 支払いアクション
    document.getElementById(SEL_G.CARD.BTN_PAY_DOODAD)?.addEventListener('click', payDoodadRpc);

    // リスナーの登録: アクション完了（パス等）
    document.getElementById(SEL_G.CARD.BTN_PASS)?.addEventListener('click', completeActionRpc);
    document.getElementById(SEL_G.CARD.BTN_BUY_STOCK)?.addEventListener('click', completeActionRpc);
    document.getElementById(SEL_G.CARD.BTN_BUY_REALESTATE)?.addEventListener('click', completeActionRpc);
    document.getElementById(SEL_G.CARD.BTN_SELL_STOCK)?.addEventListener('click', completeActionRpc);
}

console.log("【デバッグ】index_ui_cards.js が読み込まれました。");
