// index.js
import { roomId } from './common_config.js';
import { DOM_SELECTORS } from './common_dom_selectors.js';
import { toggleScreen } from './index_ui.js';
import { initCardEventListeners } from './index_ui_cards.js'; 
import { initSupabaseClient, checkExistingLogin, loginUser } from './index_auth.js';
import { startSubscriptions } from './index_state.js';
import { 
    actionRollDice, 
    actionEndTurn, 
    actionClaimPaycheck, 
    actionCheckCalculations,
    actionBorrowBankLoan,
    actionRepayBankLoan
} from './index_actions.js';

let supabase = null;
const SEL_G = DOM_SELECTORS.GUEST;

// DOM要素の取得
const inputUsername = document.getElementById(SEL_G.LOGIN.INPUT_USERNAME);
const btnLogin = document.getElementById(SEL_G.LOGIN.BTN_LOGIN);
const btnRollDice = document.getElementById(SEL_G.CONTROLS.BTN_ROLL_DICE);
const btnRollDice2 = document.getElementById(SEL_G.CONTROLS.BTN_ROLL_DICE_2); 
const btnClaimPaycheck = document.getElementById(SEL_G.CONTROLS.BTN_CLAIM_PAYCHECK);
const btnEndTurn = document.getElementById(SEL_G.CONTROLS.BTN_END_TURN);
const btnCheckCalculations = document.getElementById(SEL_G.FINANCIALS.BTN_CHECK_CALCULATIONS);
const btnBorrowLoan = document.getElementById(SEL_G.PORTFOLIO.BTN_BORROW_LOAN);
const btnPaybackLoan = document.getElementById(SEL_G.PORTFOLIO.BTN_PAYBACK_LOAN);

let currentUserId = null;
let isCardListenersReady = false; 

/**
 * ユーザーID確定後にカードイベントを登録し、DB更新用情報を受け渡す
 */
function setupCardListeners() {
    if (!isCardListenersReady && supabase && currentUserId) {
        initCardEventListeners(supabase, currentUserId);
        isCardListenersReady = true;
        console.log("[DEBUG] カードイベントリスナーを登録しました。");
    }
}

/**
 * アプリケーションの初期化
 */
(async function init() {
    console.log("[DEBUG] アプリケーションの初期化を開始します...");
    supabase = await initSupabaseClient();
    currentUserId = await checkExistingLogin(supabase, SEL_G);

    if (currentUserId) {
        console.log(`[DEBUG] 既存のログインセッションを検出しました: user_id=${currentUserId}`);
        setupCardListeners();
        toggleScreen(true);
        startSubscriptions(supabase, roomId, currentUserId);
    } else {
        console.log("[DEBUG] ログインセッションは見つかりませんでした。ログイン画面を表示します。");
        toggleScreen(false);
    }
})();

// ログインボタンのイベントリスナー
btnLogin?.addEventListener('click', async () => {
    if (!supabase) return;
    const username = inputUsername?.value.trim();
    if (!username) { alert('名前を入力してください！'); return; }

    btnLogin.disabled = true;
    const newUserId = await loginUser(supabase, username);
    
    if (newUserId) {
        currentUserId = newUserId;
        setupCardListeners();
        toggleScreen(true);
        startSubscriptions(supabase, roomId, currentUserId);
    } else {
        btnLogin.disabled = false;
    }
});

// アクション実行のイベントリスナー
btnRollDice?.addEventListener('click', () => actionRollDice(supabase, currentUserId, 1));
btnRollDice2?.addEventListener('click', () => actionRollDice(supabase, currentUserId, 2));
btnClaimPaycheck?.addEventListener('click', () => actionClaimPaycheck(supabase, currentUserId));
btnEndTurn?.addEventListener('click', () => actionEndTurn(supabase, currentUserId));
btnCheckCalculations?.addEventListener('click', () => actionCheckCalculations(supabase, currentUserId));

// 銀行ローン操作のイベントリスナー
btnBorrowLoan?.addEventListener('click', () => actionBorrowBankLoan(supabase, currentUserId));
btnPaybackLoan?.addEventListener('click', () => actionRepayBankLoan(supabase, currentUserId));

console.log("[DEBUG] index.js が正常にロードされました。");
