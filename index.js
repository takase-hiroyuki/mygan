// index.js
import { roomId } from './common_config.js';
import { SEL_G } from './common_dom_selectors.js'; 
import { toggleScreen } from './index_ui.js';

import { initSupabaseClient, checkExistingLogin, loginUser } from './index_auth.js';
import { startSubscriptions } from './index_state.js'; 
import { insertSystemMessage } from './common_utils.js'; 
import { actionRollDice, actionEndTurn } from './index_actions_turn.js';
import { actionClaimPaycheck, actionCheckCalculations } from './index_actions_finance.js';
import { actionBorrowBankLoan, actionRepayBankLoan } from './index_actions_loan.js';

let supabase = null;
let currentUserId = null;

// DOM要素の取得
const inputUsername = document.getElementById(SEL_G.LOGIN.INPUT_USERNAME);
const btnLogin = document.getElementById(SEL_G.LOGIN.BTN_LOGIN);

// コントロールボタン群
const btnRollDice = document.getElementById(SEL_G.CONTROLS.BTN_DICE1);
const btnRollDice2 = document.getElementById(SEL_G.CONTROLS.BTN_DICE_2); 
const btnClaimPaycheck = document.getElementById(SEL_G.CONTROLS.BTN_PAYCHECK);
const btnEndTurn = document.getElementById(SEL_G.CONTROLS.BTN_END_TURN);

const btnCheckCalculations = document.getElementById(SEL_G.FINANCIALS.BTN_C_CASHFLOW);

const btnBorrowLoan = document.getElementById(SEL_G.LOAN.BTN_BORROW_LOAN);
const btnPaybackLoan = document.getElementById(SEL_G.LOAN.BTN_PAYBACK_LOAN);

// 新しい取引・処理用のボタン
const btnOperate = document.getElementById(SEL_G.FINANCIALS.BTN_OPERATE);
const btnSellCard = document.getElementById(SEL_G.TRADE.BTN_SELL);
const btnTradeAccept = document.getElementById(SEL_G.TRADE.BTN_ACCEPT);
const btnTradeReject = document.getElementById(SEL_G.TRADE.BTN_REJECT);

(async function init() {
    console.log("[DEBUG] アプリケーションの初期化を開始します...");
    supabase = await initSupabaseClient();
    
    await debugSupabaseConnection(supabase);

    currentUserId = await checkExistingLogin(supabase, SEL_G);

    if (currentUserId) {
        console.log(`[DEBUG] 既存のログインセッションを検出しました: user_id=${currentUserId}`);
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
        toggleScreen(true);
        startSubscriptions(supabase, roomId, currentUserId);
    } else {
        btnLogin.disabled = false;
    }
});

btnRollDice?.addEventListener('click', () => {
    actionRollDice(supabase, currentUserId, 1);
});

btnRollDice2?.addEventListener('click', () => {
    actionRollDice(supabase, currentUserId, 2);
});

btnClaimPaycheck?.addEventListener('click', () => {
    actionClaimPaycheck(supabase, currentUserId);
});

btnEndTurn?.addEventListener('click', () => {
    actionEndTurn(supabase, currentUserId);
});

btnCheckCalculations?.addEventListener('click', () => {
    actionCheckCalculations(supabase, currentUserId);
});

btnBorrowLoan?.addEventListener('click', () => {
    actionBorrowBankLoan(supabase, currentUserId);
});

btnPaybackLoan?.addEventListener('click', () => {
    actionRepayBankLoan(supabase, currentUserId);
});

// ============================================================================
// 以降は今回新設した「アイテム処理」および「トレード」用の仮リスナー
// ============================================================================

btnOperate?.addEventListener('click', () => {
    console.log("[DEBUG-UI] 「X 処理する」ボタンが押下されました（現在準備中）");
    // TODO: ここで選択されたアイテムの売却や返済を行うRPCを呼び出す
});

btnSellCard?.addEventListener('click', async () => {
    await insertSystemMessage(supabase, "システム", "カードの売却提案機能は現在準備中です。");
});

btnTradeAccept?.addEventListener('click', async () => {
    await insertSystemMessage(supabase, "システム", "トレードの承諾機能は現在準備中です。");
});

btnTradeReject?.addEventListener('click', async () => {
    await insertSystemMessage(supabase, "システム", "トレードの拒否機能は現在準備中です。");
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
