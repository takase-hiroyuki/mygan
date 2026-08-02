// index_ui_cards_ui.js
import { setButtonActive, setMultipleButtonsActive, CELLS_OPPORTUNITY, CELLS_MARKET, CELLS_DOODAD, CELLS_CHARITY, CELLS_DOWNSIZED } from './common_utils.js';
import { SEL_G } from './common_dom_selectors.js';

export function updateCardPhaseUI(position, flags = {}, currentCard = null, playerName = "現在のプレイヤー") {
    const drawButtons = [
        SEL_G.CARD.BTN_DRAW_SMALL_DEAL, SEL_G.CARD.BTN_DRAW_BIG_DEAL,
        SEL_G.CARD.BTN_DRAW_MARKET, SEL_G.CARD.BTN_DRAW_DOODAD,
        SEL_G.CARD.BTN_ACTION_DONATE, SEL_G.CARD.BTN_ACTION_DOWNSIZED
    ];
    const actionButtons = [
        SEL_G.CARD.BTN_BUY_REALESTATE, SEL_G.CARD.BTN_BUY_STOCK,
        SEL_G.CARD.BTN_SELL_STOCK, SEL_G.CARD.BTN_PASS, SEL_G.CARD.BTN_EXECUTE_PAYMENT 
    ];
    
    setMultipleButtonsActive(drawButtons, false);
    setMultipleButtonsActive(actionButtons, false);

    // マイナスキャッシュフローの「支払い義務」がある時のみ汎用支払いボタンを強制する
    if (flags.is_negative_cash_flow && (flags.pending_paydays || 0) > 0) {
        setButtonActive(SEL_G.CARD.BTN_EXECUTE_PAYMENT, true);
        return;
    }
    if (flags.is_action_completed) return;

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
        // ★修正: いきなり支払いではなく「寄付アクション」ボタンと「パス」ボタンを有効にする
        setButtonActive(SEL_G.CARD.BTN_ACTION_DONATE, true);
        setButtonActive(SEL_G.CARD.BTN_PASS, true);
    } else if (CELLS_DOWNSIZED.includes(position)) {
        setButtonActive(SEL_G.CARD.BTN_ACTION_DOWNSIZED, true);
    }
}

console.log("【デバッグ】index_ui_cards_ui.js が読み込まれました。");
