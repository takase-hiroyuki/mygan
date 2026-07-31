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
    
    // ネットワーク接続・データ整合性確認用デバッグ関数を実行
    await debugSupabaseConnection(supabase);

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

// ==========================================
// イベントリスナーの登録
// ==========================================

// ログインボタンのイベントリスナー
btnLogin?.addEventListener('click', async () => {
    console.log("[DEBUG-UI] 「ログイン」ボタンが押下されました");
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
btnRollDice?.addEventListener('click', () => {
    console.log("[DEBUG-UI] 「サイコロ１個」ボタンが押下されました");
    actionRollDice(supabase, currentUserId, 1);
});

btnRollDice2?.addEventListener('click', () => {
    console.log("[DEBUG-UI] 「サイコロ２個」ボタンが押下されました");
    actionRollDice(supabase, currentUserId, 2);
});

btnClaimPaycheck?.addEventListener('click', () => {
    console.log("[DEBUG-UI] 「Paycheck請求」ボタンが押下されました");
    actionClaimPaycheck(supabase, currentUserId);
});

btnEndTurn?.addEventListener('click', () => {
    console.log("[DEBUG-UI] 「手番終了」ボタンが押下されました");
    actionEndTurn(supabase, currentUserId);
});

btnCheckCalculations?.addEventListener('click', () => {
    console.log("[DEBUG-UI] 「計算チェック」ボタンが押下されました");
    actionCheckCalculations(supabase, currentUserId);
});

// 銀行ローン操作のイベントリスナー
btnBorrowLoan?.addEventListener('click', () => {
    console.log("[DEBUG-UI] 「銀行ローンを借り入れる」ボタンが押下されました");
    actionBorrowBankLoan(supabase, currentUserId);
});

btnPaybackLoan?.addEventListener('click', () => {
    console.log("[DEBUG-UI] 「銀行ローンを返済する」ボタンが押下されました");
    actionRepayBankLoan(supabase, currentUserId);
});

console.log("[DEBUG] index.js が正常にロードされました。");


// ==========================================
// デバッグ機能
// ==========================================

/**
 * Supabaseネットワーク疎通確認用デバッグ関数
 * @param {Object} supabaseClient 
 */
async function debugSupabaseConnection(supabaseClient) {
    console.log("[DEBUG-NETWORK] 接続テストを開始します。");
    try {
        const startTime = performance.now();
        const { data, error } = await supabaseClient.from('cards').select('id').limit(1);
        const endTime = performance.now();

        if (error) {
            console.error(`[DEBUG-NETWORK] 応答エラー (${(endTime - startTime).toFixed(2)}ms):`, error);
        } else {
            console.log(`[DEBUG-NETWORK] 接続成功 (${(endTime - startTime).toFixed(2)}ms):`, data);
        }
    } catch (err) {
        console.error("[DEBUG-NETWORK] fetch例外発生:", err.name, err.message, err);
    }
}
