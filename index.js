/*
UIの制御において、複数の場所でボタンのアクティブ・非アクティブを個別に切り替えると、必ず状態の矛盾（バグ）が発生します。システム設計において非常に重要で鋭い視点です。
そのため、本システムでは 「ボタンの操作は直接画面を変更せず、データベース（state）を更新するだけにとどめ、画面の描画は常に最新のデータベースを読み込んで『一箇所』で決定する」 という設計（データ駆動アーキテクチャ）を採用しています。「次の人へ」ボタンの有効・無効を決定する唯一の判定場所は、index_ui.js の renderGuestUI 関数内になります。そこに、ご提示いただいた条件をすべて集約した以下のロジックを配置します。ただし、通信中フラグのためだけに画面全体を描画する関数（renderGuestUI）を呼び直すと、入力欄のフォーカスが外れる、画面がちらつくなどの副作用が発生する。そのため、「通信直前のボタン無効化と、完了後の有効化」に限っては、例外として直接DOMを操作することが実用的な標準手法として広く採用します。
*/

// index.js

import { roomId } from './common_config.js';
import { SEL_G } from './common_dom_selectors.js'; 

import { toggleScreen, renderBaseUI } from './index_ui_base.js';
import { applyUIRules } from './index_ui_rules.js';
import { initSupabaseClient, checkExistingLogin, loginUser } from './index_auth.js';
import { startSubscriptions } from './index_state.js'; 
import { insertSystemMessage } from './common_utils.js'; 
// ★修正: actionProcessSelf は index_actions_turn.js からインポートする
import { actionRollDice, actionEndTurn, actionDrawCard, actionPass, actionProcessSelf } from './index_actions_turn.js';
import { actionClaimPaycheck, actionCheckCalculations, actionOperateItem } from './index_actions_finance.js'; 
import { actionBorrowBankLoan, actionRepayBankLoan } from './index_actions_loan.js';
import { actionProposeTrade, actionAcceptTrade, actionRejectTrade } from './index_actions_trade.js';

let supabase = null;
let currentUserId = null;

const inputUsername = document.getElementById(SEL_G.LOGIN.INPUT_USERNAME);
const btnLogin = document.getElementById(SEL_G.LOGIN.BTN_LOGIN);
const btnRollDice = document.getElementById(SEL_G.CONTROLS.BTN_DICE1);
const btnRollDice2 = document.getElementById(SEL_G.CONTROLS.BTN_DICE_2); 
const btnClaimPaycheck = document.getElementById(SEL_G.CONTROLS.BTN_PAYCHECK);
const btnEndTurn = document.getElementById(SEL_G.CONTROLS.BTN_END_TURN);
const btnCheckCalculations = document.getElementById(SEL_G.FINANCIALS.BTN_C_CASHFLOW);
const btnBorrowLoan = document.getElementById(SEL_G.LOAN.BTN_BORROW_LOAN);
const btnPaybackLoan = document.getElementById(SEL_G.LOAN.BTN_PAYBACK_LOAN);
const btnSmallDeal = document.getElementById(SEL_G.CARD.BTN_SMALL_DEAL);
const btnBigDeal = document.getElementById(SEL_G.CARD.BTN_BIG_DEAL);
const btnOperate = document.getElementById(SEL_G.FINANCIALS.BTN_OPERATE);
const btnSellCard = document.getElementById(SEL_G.TRADE.BTN_SELL);
const btnFastTrack = document.getElementById(SEL_G.FINANCIALS.BTN_FAST_TRACK); // ★追加: ファーストトラックボタン

// 取引・カード処理用ボタンの取得
const btnProcessSelf = document.getElementById(SEL_G.TRADE.BTN_PROCESS_SELF);
const btnPassCard = document.getElementById(SEL_G.TRADE.BTN_PASS_CARD);
const btnTradeAccept = document.getElementById(SEL_G.TRADE.BTN_ACCEPT);
const btnTradeReject = document.getElementById(SEL_G.TRADE.BTN_REJECT);

function updateUI(userId, participants, room) {
    renderBaseUI(userId, participants, room, () => {
        updateUI(userId, participants, room);
    });
    applyUIRules(userId, participants, room);
}

(async function init() {
    console.log("[DEBUG] アプリケーションの初期化を開始します...");
    supabase = await initSupabaseClient();
    
    await debugSupabaseConnection(supabase);

    currentUserId = await checkExistingLogin(supabase, SEL_G);

    if (currentUserId) {
        console.log(`[DEBUG] 既存のログインセッションを検出しました: user_id=${currentUserId}`);
        toggleScreen(true);
        startSubscriptions(supabase, roomId, currentUserId, updateUI);
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
        startSubscriptions(supabase, roomId, currentUserId, updateUI);
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

btnSmallDeal?.addEventListener('click', () => {
    actionDrawCard(supabase, currentUserId, 'small_deal');
});

btnBigDeal?.addEventListener('click', () => {
    actionDrawCard(supabase, currentUserId, 'big_deal');
});

btnOperate?.addEventListener('click', () => {
    actionOperateItem(supabase, currentUserId);
});

btnSellCard?.addEventListener('click', () => {
    actionProposeTrade(supabase, currentUserId);
});

// ★追加: ファーストトラックのダミーリスナー
btnFastTrack?.addEventListener('click', () => {
    console.log("[DEBUG] ファーストトラック移行ボタンが押下されました。(現在はダミーリスナー)");
    // 今後ここにファーストトラック移行処理を実装する
});

// ★修正: 寄付および株の購入処理（数量の取得を追加）
btnProcessSelf?.addEventListener('click', () => {
    const numInput = document.getElementById(SEL_G.TRADE.NUM_PROCESS_SELF);
    const qty = numInput && !numInput.hidden ? parseInt(numInput.value, 10) || 1 : 1;
    actionProcessSelf(supabase, currentUserId, qty);
});

btnPassCard?.addEventListener('click', async () => {
    await actionPass(supabase, currentUserId);
});

btnTradeAccept?.addEventListener('click', () => {
    actionAcceptTrade(supabase, currentUserId);
});

btnTradeReject?.addEventListener('click', () => {
    actionRejectTrade(supabase, currentUserId);
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

console.log("【残す】 index.js が正常にロードされました。");
