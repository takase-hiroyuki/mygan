/*
UIの制御において、複数の場所でボタンのアクティブ・非アクティブを個別に切り替えると、必ず状態の矛盾（バグ）が発生します。システム設計において非常に重要で鋭い視点です。
そのため、本システムでは 「ボタンの操作は直接画面を変更せず、データベース（state）を更新するだけにとどめ、画面の描画は常に最新のデータベースを読み込んで『一箇所』で決定する」 という設計（データ駆動アーキテクチャ）を採用しています。「次の人へ」ボタンの有効・無効を決定する唯一の判定場所は、index_ui.js の renderGuestUI 関数内になります。そこに、ご提示いただいた条件をすべて集約した以下のロジックを配置します。ただし、通信中フラグのためだけに画面全体を描画する関数（renderGuestUI）を呼び直すと、入力欄のフォーカスが外れる、画面がちらつくなどの副作用が発生する。そのため、「通信直前のボタン無効化と、完了後の有効化」に限っては、例外として直接DOMを操作することが実用的な標準手法として広く採用します。

具体的には以下の3つのケースに分類されます。

1. ゲーム進行（ターンや位置）の崩壊
「サイコロを振る」の二重実行： 1回目の移動先マス（例: 商売や寄付）のイベントをスキップし、2回目の出目のマスへ強制的に移動・上書きされる。

「次の人へ」の二重実行： 自分のターンを終了した直後に、次の順番のプレイヤーのターンまで強制的にスキップ（終了）させてしまう。

2. 強制支出による予期せぬ「破産」
「無駄遣いマス」「子供のマス」での支払いの二重実行： 支出が二重に引き落とされる。銀行借入と異なり「返金」アクションは存在しないため、この二重引き落としによって所持金がマイナスに転じた場合、システムによって意図しない「破産（ゲームオーバー、強制退場）」が発動する。

3. 不可逆な取引の二重実行
株や不動産の「購入する」の二重実行： 「1,000株買う」リクエストが2回処理され、2,000株分の現金を失う。ゲームのルール上、資産は「誰かが売却カードを引く」などの市場イベントが発生しない限り自発的に売却（現金化）できないため、取り返しがつかない。

フロントエンドにおける「ボタンを一時的に無効化するDOM操作」は、RPC内部における厳密な状態チェック（フラグ管理）の漏れがあった場合でも、ユーザー起因による上記の「不可逆な致命的進行」を最前線で物理的に遮断する役割を担っています。
*/

// index.js

import { roomId } from './common_config.js';
import { SEL_G } from './common_dom_selectors.js'; 

import { toggleScreen, renderBaseUI } from './index_ui_base.js';
import { applyUIRules } from './index_ui_rules.js';
import { initSupabaseClient, checkExistingLogin, loginUser } from './index_auth.js';
import { startSubscriptions } from './index_state.js'; 
import { writeLog, getLocalPlayerName } from './common_utils.js'; 
import { actionRollDice, actionEndTurn, actionDrawCard, actionPass, actionProcessSelf } from './index_actions_turn.js';
import { actionClaimPaycheck, actionCheckCalculations, actionOperateItem } from './index_actions_finance.js'; 
import { actionBorrowBankLoan, actionRepayBankLoan } from './index_actions_loan.js';
import { actionProposeTrade, actionAcceptTrade, actionRejectTrade } from './index_actions_trade.js';

let supabase = null;
let currentUserId = null;
let cachedParticipantsList = []; 

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
const btnFastTrack = document.getElementById(SEL_G.FINANCIALS.BTN_FAST_TRACK); 

const btnProcessSelf = document.getElementById(SEL_G.TRADE.BTN_PROCESS_SELF);
const btnPassCard = document.getElementById(SEL_G.TRADE.BTN_PASS_CARD);
const btnTradeAccept = document.getElementById(SEL_G.TRADE.BTN_ACCEPT);
const btnTradeReject = document.getElementById(SEL_G.TRADE.BTN_REJECT);

function updateUI(userId, participants, room) {
    cachedParticipantsList = participants;
    
    renderBaseUI(userId, participants, room, () => {
        updateUI(userId, participants, room);
    });
    applyUIRules(userId, participants, room);
}

(async function init() {
    supabase = await initSupabaseClient();
    writeLog(supabase, "System", "Init", "アプリケーションの初期化を開始します...");
    
    await debugSupabaseConnection(supabase);

    currentUserId = await checkExistingLogin(supabase, SEL_G);

    if (currentUserId) {
        writeLog(supabase, "System", "Init", `既存のログインセッションを検出しました: user_id=${currentUserId}`);
        toggleScreen(true);
        startSubscriptions(supabase, roomId, currentUserId, updateUI);
    } else {
        writeLog(supabase, "System", "Init", "ログインセッションは見つかりませんでした。ログイン画面を表示します。");
        toggleScreen(false);
    }
})();

// イベントリスナーの登録
btnLogin?.addEventListener('click', async () => {
    writeLog(supabase, "System", "Action", "「入室する」ボタンが押下されました");
    if (!supabase) return;
    const username = inputUsername?.value.trim();
    if (!username) { 
        // 画面への表示をやめ、ログへの記録のみに変更
        writeLog(supabase, "System", "Auth Error", "名前が入力されていません。");
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
    writeLog(supabase, getLocalPlayerName(), "Action", "「サイコロ１個」ボタンが押下されました");
    actionRollDice(supabase, currentUserId, 1);
});

btnRollDice2?.addEventListener('click', () => {
    writeLog(supabase, getLocalPlayerName(), "Action", "「サイコロ２個」ボタンが押下されました");
    actionRollDice(supabase, currentUserId, 2);
});

btnClaimPaycheck?.addEventListener('click', () => {
    writeLog(supabase, getLocalPlayerName(), "Action", "「入金請求」ボタンが押下されました");
    actionClaimPaycheck(supabase, currentUserId);
});

btnEndTurn?.addEventListener('click', () => {
    actionEndTurn(supabase, currentUserId);
});

btnCheckCalculations?.addEventListener('click', () => {
    writeLog(supabase, getLocalPlayerName(), "Action", "「計算」ボタンが押下されました");
    actionCheckCalculations(supabase, currentUserId);
});

btnBorrowLoan?.addEventListener('click', () => {
    writeLog(supabase, getLocalPlayerName(), "Action", "「銀行借入」ボタンが押下されました");
    actionBorrowBankLoan(supabase, currentUserId);
});

btnPaybackLoan?.addEventListener('click', () => {
    writeLog(supabase, getLocalPlayerName(), "Action", "「銀行返済」ボタンが押下されました");
    actionRepayBankLoan(supabase, currentUserId);
});

btnSmallDeal?.addEventListener('click', () => {
    writeLog(supabase, getLocalPlayerName(), "Action", "「普通の商売」ボタンが押下されました");
    actionDrawCard(supabase, currentUserId, 'small_deal');
});

btnBigDeal?.addEventListener('click', () => {
    writeLog(supabase, getLocalPlayerName(), "Action", "「大きい商売」ボタンが押下されました");
    actionDrawCard(supabase, currentUserId, 'big_deal');
});

btnOperate?.addEventListener('click', () => {
    writeLog(supabase, getLocalPlayerName(), "Action", "「実際に処理する(資産負債)」ボタンが押下されました");
    actionOperateItem(supabase, currentUserId);
});

btnSellCard?.addEventListener('click', () => {
    writeLog(supabase, getLocalPlayerName(), "Action", "「交渉持掛」ボタンが押下されました");
    actionProposeTrade(supabase, currentUserId);
});

btnFastTrack?.addEventListener('click', () => {
    writeLog(supabase, getLocalPlayerName(), "Action", "「ファーストトラック」ボタンが押下されました");
});

btnProcessSelf?.addEventListener('click', () => {
    writeLog(supabase, getLocalPlayerName(), "Action", "「購入する・支払う」ボタンが押下されました");
    const numInput = document.getElementById(SEL_G.TRADE.NUM_PROCESS_SELF);
    const qty = numInput && !numInput.hidden ? parseInt(numInput.value, 10) || 1 : 1;
    actionProcessSelf(supabase, currentUserId, qty);
});

btnPassCard?.addEventListener('click', async () => {
    writeLog(supabase, getLocalPlayerName(), "Action", "「パスする」ボタンが押下されました");
    await actionPass(supabase, currentUserId);
});

btnTradeAccept?.addEventListener('click', () => {
    writeLog(supabase, getLocalPlayerName(), "Action", "「承諾」ボタンが押下されました");
    actionAcceptTrade(supabase, currentUserId);
});

btnTradeReject?.addEventListener('click', () => {
    writeLog(supabase, getLocalPlayerName(), "Action", "「拒否」ボタンが押下されました");
    actionRejectTrade(supabase, currentUserId);
});

async function debugSupabaseConnection(supabaseClient) {
    writeLog(supabaseClient, "System", "Network", "接続テストを開始します。");
    try {
        const startTime = performance.now();
        const { data, error } = await supabaseClient.from('cards').select('id').limit(1);
        const endTime = performance.now();

        if (error) {
            writeLog(supabaseClient, "System", "Network Error", `応答エラー (${(endTime - startTime).toFixed(2)}ms): ${JSON.stringify(error)}`);
        } else {
            writeLog(supabaseClient, "System", "Network", `接続成功 (${(endTime - startTime).toFixed(2)}ms)`);
        }
    } catch (err) {
        writeLog(supabaseClient, "System", "Network Error", `fetch例外発生: ${err.name} ${err.message}`);
    }
}

console.log("【残す】 index.js が正常にロードされました。");
