// index_ui_cards.js
import { DOM_SELECTORS } from './common_dom_selectors.js';
import { setButtonActive, setMultipleButtonsActive } from './common_utils.js';

const SEL_G = DOM_SELECTORS.GUEST;

// ==========================================
// マスの種類ごとのインデックス定義
// ==========================================
const CELLS_OPPORTUNITY = [2, 4, 6, 8, 10, 13, 15, 17, 19, 21, 23];
const CELLS_DOODAD = [1, 7, 14];
const CELLS_MARKET = [12, 22];

/**
 * フラグをデータベースに直接保存するローカルヘルパー関数
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
 * 現在地に応じてカードフェーズのUIを切り替える（手番終了のロック制御を含む）
 * ※ index.js から盤面移動直後などに直接呼び出される
 */
export function updateCardPhaseUI(position) {
    console.log("【デバッグ】updateCardPhaseUI");
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
    let requireCardAction = false;

    // 現在地のマス属性判定
    if (CELLS_OPPORTUNITY.includes(position)) {
        console.log("【デバッグ】Cells Opportunity ?");
        setButtonActive(SEL_G.CARD.BTN_DRAW_SMALL_DEAL, true);
        setButtonActive(SEL_G.CARD.BTN_DRAW_BIG_DEAL, true);
        requireCardAction = true;
    } else if (CELLS_MARKET.includes(position)) {
        console.log("【デバッグ】Cells Market ?");
        setButtonActive(SEL_G.CARD.BTN_DRAW_MARKET, true);
        requireCardAction = true;
    } else if (CELLS_DOODAD.includes(position)) {
        console.log("【デバッグ】Cells Doodad ?");
        setButtonActive(SEL_G.CARD.BTN_DRAW_DOODAD, true);
        requireCardAction = true;
    }

    // アクション必須マスに止まった場合は手番終了をロック
    if (requireCardAction) {
        console.log("【デバッグ】アクション必須");
        setButtonActive(SEL_G.CONTROLS.BTN_END_TURN, false);
        if (statusMessage) statusMessage.textContent = "カードを引いてください。アクション必須";
    } else {
        if (statusMessage) statusMessage.textContent = "現在場に出ているカードはありません。";
    }
}

/**
 * カードアクション関連のイベントリスナーを初期化する
 * ※ index.js から DB通信用の supabase と currentUserId を受け取るように変更
 */
export function initCardEventListeners(supabase, currentUserId) {
    // ------------------------------------------
    // ドローボタン押下時の動作
    // ------------------------------------------
    document.getElementById(SEL_G.CARD.BTN_DRAW_SMALL_DEAL)?.addEventListener('click', async () => {
        console.log("【デバッグ】small deal card");
        setButtonActive(SEL_G.CARD.BTN_DRAW_SMALL_DEAL, false);
        setButtonActive(SEL_G.CARD.BTN_DRAW_BIG_DEAL, false);
        setButtonActive(SEL_G.CARD.BTN_BUY_STOCK, true);
        setButtonActive(SEL_G.CARD.BTN_BUY_REALESTATE, true);
        setButtonActive(SEL_G.CARD.BTN_PASS, true);
        
        const msg = document.getElementById(SEL_G.CARD.STATUS_MESSAGE);
        if (msg) msg.textContent = "【UIテスト】Small Dealを引きました。購入するか、パスしてください。";

        // ★追加: カードを引いたフラグを立てる
        await updateCardFlag(supabase, currentUserId, 'is_card_drawn', true);
    });

    document.getElementById(SEL_G.CARD.BTN_DRAW_BIG_DEAL)?.addEventListener('click', async () => {
        console.log("【デバッグ】big deal card");
        setButtonActive(SEL_G.CARD.BTN_DRAW_SMALL_DEAL, false);
        setButtonActive(SEL_G.CARD.BTN_DRAW_BIG_DEAL, false);
        setButtonActive(SEL_G.CARD.BTN_BUY_REALESTATE, true);
        setButtonActive(SEL_G.CARD.BTN_PASS, true);
        
        const msg = document.getElementById(SEL_G.CARD.STATUS_MESSAGE);
        if (msg) msg.textContent = "【UIテスト】Big Dealを引きました。購入するか、パスしてください。";

        // ★追加: カードを引いたフラグを立てる
        await updateCardFlag(supabase, currentUserId, 'is_card_drawn', true);
    });

    document.getElementById(SEL_G.CARD.BTN_DRAW_MARKET)?.addEventListener('click', async () => {
        console.log("【デバッグ】market card");
        setButtonActive(SEL_G.CARD.BTN_DRAW_MARKET, false);
        setButtonActive(SEL_G.CARD.BTN_SELL_STOCK, true);
        setButtonActive(SEL_G.CARD.BTN_PASS, true);
        
        const msg = document.getElementById(SEL_G.CARD.STATUS_MESSAGE);
        if (msg) msg.textContent = "【UIテスト】Marketを引きました。売却するか、パスしてください。";

        // ★追加: カードを引いたフラグを立てる
        await updateCardFlag(supabase, currentUserId, 'is_card_drawn', true);
    });

    document.getElementById(SEL_G.CARD.BTN_DRAW_DOODAD)?.addEventListener('click', async () => {
        console.log("【デバッグ】doodad card");
        setButtonActive(SEL_G.CARD.BTN_DRAW_DOODAD, false);
        setButtonActive(SEL_G.CARD.BTN_PAY_DOODAD, true);
        setButtonActive(SEL_G.CARD.BTN_PASS, false); // Doodadはパス不可
        setButtonActive(SEL_G.CONTROLS.BTN_END_TURN, false); // 強制支払いのためのロック
        
        const msg = document.getElementById(SEL_G.CARD.STATUS_MESSAGE);
        if (msg) msg.textContent = "【UIテスト】Doodadを引きました。必ず費用を支払ってください。";

        // ★追加: カードを引いたフラグを立てる
        await updateCardFlag(supabase, currentUserId, 'is_card_drawn', true);
    });

    // ------------------------------------------
    // アクション完了後のUIリセット処理
    // ------------------------------------------
    const resetCardUI = async () => {
        setMultipleButtonsActive([
            SEL_G.CARD.BTN_BUY_REALESTATE, SEL_G.CARD.BTN_BUY_STOCK, 
            SEL_G.CARD.BTN_SELL_STOCK, SEL_G.CARD.BTN_PAY_DOODAD, SEL_G.CARD.BTN_PASS
        ], false);
        
        // アクション完了により「手番終了」と「ローン操作」を解放
        setButtonActive(SEL_G.CONTROLS.BTN_END_TURN, true);
        setButtonActive(SEL_G.PORTFOLIO.BTN_BORROW_LOAN, true);
        setButtonActive(SEL_G.PORTFOLIO.BTN_PAYBACK_LOAN, true);
        
        const msg = document.getElementById(SEL_G.CARD.STATUS_MESSAGE);
        if (msg) msg.textContent = "【UIテスト】カードアクション完了。ローン操作を行うか、手番を終了してください。";

        // ★追加: アクション完了フラグを立てる
        await updateCardFlag(supabase, currentUserId, 'is_action_completed', true);
    };

    // 各種アクションボタンにリセット処理を紐付け
    document.getElementById(SEL_G.CARD.BTN_PASS)?.addEventListener('click', resetCardUI);
    document.getElementById(SEL_G.CARD.BTN_BUY_STOCK)?.addEventListener('click', resetCardUI);
    document.getElementById(SEL_G.CARD.BTN_BUY_REALESTATE)?.addEventListener('click', resetCardUI);
    document.getElementById(SEL_G.CARD.BTN_SELL_STOCK)?.addEventListener('click', resetCardUI);
    document.getElementById(SEL_G.CARD.BTN_PAY_DOODAD)?.addEventListener('click', resetCardUI);
}

console.log("【デバッグ】index_ui_cards.js が読み込まれました。");
