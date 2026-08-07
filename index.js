// index.js
import { roomId } from './common_config.js';
import { SEL_G } from './common_dom_selectors.js'; 
import { toggleScreen } from './index_ui.js';

import { initCardEventListeners } from './index_ui_cards_events.js'; 
import { executeGenericPayment } from './index_ui_cards_payment.js';

import { initSupabaseClient, checkExistingLogin, loginUser } from './index_auth.js';
import { startSubscriptions } from './index_state.js'; 
import { insertSystemMessage } from './common_utils.js'; 
import { actionRollDice, actionEndTurn } from './index_actions_turn.js';
import { actionClaimPaycheck, actionCheckCalculations } from './index_actions_finance.js';
import { actionBorrowBankLoan, actionRepayBankLoan } from './index_actions_loan.js';

let supabase = null;

// DOM要素の取得
const inputUsername = document.getElementById(SEL_G.LOGIN.INPUT_USERNAME);
const btnLogin = document.getElementById(SEL_G.LOGIN.BTN_LOGIN);

// セレクターを新しい定義に更新
const btnRollDice = document.getElementById(SEL_G.CONTROLS.BTN_DICE1);
const btnRollDice2 = document.getElementById(SEL_G.CONTROLS.BTN_DICE_2); 
const btnClaimPaycheck = document.getElementById(SEL_G.CONTROLS.BTN_PAYCHECK);
const btnEndTurn = document.getElementById(SEL_G.CONTROLS.BTN_END_TURN);

const btnCheckCalculations = document.getElementById(SEL_G.FINANCIALS.BTN_C_CASHFLOW);

const btnBorrowLoan = document.getElementById(SEL_G.LOAN.BTN_BORROW_LOAN);
const btnPaybackLoan = document.getElementById(SEL_G.LOAN.BTN_PAYBACK_LOAN);

// 処理用の入力欄とボタンを新しいHTML構造に合わせて更新
const inputPaymentAmount = document.getElementById(SEL_G.FINANCIALS.INPUT_CASHFLOW);
const btnExecutePayment = document.getElementById(SEL_G.FINANCIALS.BTN_OPERATE);

let currentUserId = null;
let isCardListenersReady = false; 

function setupCardListeners() {
    if (!isCardListenersReady && supabase && currentUserId) {
        initCardEventListeners(supabase, currentUserId);
        isCardListenersReady = true;
        console.log("[DEBUG] カードイベントリスナーを登録しました。");
    }
}

(async function init() {
    console.log("[DEBUG] アプリケーションの初期化を開始します...");
    supabase = await initSupabaseClient();
    
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

// イベントリスナーの登録
btnLogin?.addEventListener('click', async () => {
    console.log("[DEBUG-UI] 「ログイン」ボタンが押下されました");
    if (!supabase) return;
    const username = inputUsername?.value.trim();
    if (!username) { 
        await insertSystemMessage(supabase, "システム", "名前を入力してください。");
        return; 
    }

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

btnBorrowLoan?.addEventListener('click', () => {
    console.log("[DEBUG-UI] 「銀行ローンを借り入れる」ボタンが押下されました");
    actionBorrowBankLoan(supabase, currentUserId);
});

btnPaybackLoan?.addEventListener('click', () => {
    console.log("[DEBUG-UI] 「銀行ローンを返済する」ボタンが押下されました");
    actionRepayBankLoan(supabase, currentUserId);
});

btnExecutePayment?.addEventListener('click', () => {
    console.log("[DEBUG-UI] 「支払いを実行」ボタンが押下されました");
    if (!supabase || !currentUserId) return;
    
    const amountStr = inputPaymentAmount ? inputPaymentAmount.value.trim() : "";
    if (typeof executeGenericPayment === 'function') {
        executeGenericPayment(supabase, currentUserId, amountStr);
    } else {
        console.warn("[DEBUG-UI] executeGenericPayment がまだ実装されていません。");
    }
});

// デバッグ機能
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

console.log("[デバッグ] index.js が正常にロードされました。");
