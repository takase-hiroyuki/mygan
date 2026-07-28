// index_ui_cards.js
import { DOM_SELECTORS } from './common_dom_selectors.js';
import { setButtonActive, setMultipleButtonsActive } from './common_utils.js';

const SEL_G = DOM_SELECTORS.GUEST;

// マスの種類ごとのインデックス定義
const CELLS_OPPORTUNITY = [2, 4, 6, 8, 10, 13, 15, 17, 19, 21, 23];
const CELLS_DOODAD = [1, 7, 14];
const CELLS_MARKET = [12, 22];

/**
 * 現在地に応じてカードフェーズのUIを切り替える（手番終了のロック制御を含む）
 */
export function updateCardPhaseUI(position) {
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
    
    setMultipleButtonsActive(drawButtons, false);
    setMultipleButtonsActive(actionButtons, false);

    const statusMessage = document.getElementById(SEL_G.CARD.STATUS_MESSAGE);
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
        setButtonActive(SEL_G.CONTROLS.BTN_END_TURN, false);
        if (statusMessage) statusMessage.textContent = "カードを引いてください。（アクション完了まで手番は終了できません）";
    } else {
        if (statusMessage) statusMessage.textContent = "現在場に出ているカードはありません。";
    }
}

/**
 * カードアクション関連のイベントリスナーを初期化する
 */
export function initCardEventListeners() {
    document.getElementById(SEL_G.CARD.BTN_DRAW_SMALL_DEAL)?.addEventListener('click', () => {
        setButtonActive(SEL_G.CARD.BTN_DRAW_SMALL_DEAL, false);
        setButtonActive(SEL_G.CARD.BTN_DRAW_BIG_DEAL, false);
        setButtonActive(SEL_G.CARD.BTN_BUY_STOCK, true);
        setButtonActive(SEL_G.CARD.BTN_BUY_REALESTATE, true);
        setButtonActive(SEL_G.CARD.BTN_PASS, true);
        
        const msg = document.getElementById(SEL_G.CARD.STATUS_MESSAGE);
        if (msg) msg.textContent = "【UIテスト】Small Dealを引きました。購入するか、パスしてください。";
    });

    document.getElementById(SEL_G.CARD.BTN_DRAW_BIG_DEAL)?.addEventListener('click', () => {
        setButtonActive(SEL_G.CARD.BTN_DRAW_SMALL_DEAL, false);
        setButtonActive(SEL_G.CARD.BTN_DRAW_BIG_DEAL, false);
        setButtonActive(SEL_G.CARD.BTN_BUY_REALESTATE, true);
        setButtonActive(SEL_G.CARD.BTN_PASS, true);
        
        const msg = document.getElementById(SEL_G.CARD.STATUS_MESSAGE);
        if (msg) msg.textContent = "【UIテスト】Big Dealを引きました。購入するか、パスしてください。";
    });

    document.getElementById(SEL_G.CARD.BTN_DRAW_MARKET)?.addEventListener('click', () => {
        setButtonActive(SEL_G.CARD.BTN_DRAW_MARKET, false);
        setButtonActive(SEL_G.CARD.BTN_SELL_STOCK, true);
        setButtonActive(SEL_G.CARD.BTN_PASS, true);
        
        const msg = document.getElementById(SEL_G.CARD.STATUS_MESSAGE);
        if (msg) msg.textContent = "【UIテスト】Marketを引きました。売却するか、パスしてください。";
    });

    document.getElementById(SEL_G.CARD.BTN_DRAW_DOODAD)?.addEventListener('click', () => {
        setButtonActive(SEL_G.CARD.BTN_DRAW_DOODAD, false);
        setButtonActive(SEL_G.CARD.BTN_PAY_DOODAD, true);
        setButtonActive(SEL_G.CARD.BTN_PASS, false);
        setButtonActive(SEL_G.CONTROLS.BTN_END_TURN, false); // 強制支払いのためのロック
        
        const msg = document.getElementById(SEL_G.CARD.STATUS_MESSAGE);
        if (msg) msg.textContent = "【UIテスト】Doodadを引きました。必ず費用を支払ってください。";
    });

    const resetCardUI = () => {
        setMultipleButtonsActive([
            SEL_G.CARD.BTN_BUY_REALESTATE, SEL_G.CARD.BTN_BUY_STOCK, 
            SEL_G.CARD.BTN_SELL_STOCK, SEL_G.CARD.BTN_PAY_DOODAD, SEL_G.CARD.BTN_PASS
        ], false);
        
        setButtonActive(SEL_G.CONTROLS.BTN_END_TURN, true);
        setButtonActive(SEL_G.PORTFOLIO.BTN_BORROW_LOAN, true);
        setButtonActive(SEL_G.PORTFOLIO.BTN_PAYBACK_LOAN, true);
        
        const msg = document.getElementById(SEL_G.CARD.STATUS_MESSAGE);
        if (msg) msg.textContent = "【UIテスト】カードアクション完了。ローン操作を行うか、手番を終了してください。";
    };

    document.getElementById(SEL_G.CARD.BTN_PASS)?.addEventListener('click', resetCardUI);
    document.getElementById(SEL_G.CARD.BTN_BUY_STOCK)?.addEventListener('click', resetCardUI);
    document.getElementById(SEL_G.CARD.BTN_BUY_REALESTATE)?.addEventListener('click', resetCardUI);
    document.getElementById(SEL_G.CARD.BTN_SELL_STOCK)?.addEventListener('click', resetCardUI);
    document.getElementById(SEL_G.CARD.BTN_PAY_DOODAD)?.addEventListener('click', resetCardUI);
}

console.log("【デバッグ】index_ui_cards.js が読み込まれました。");
