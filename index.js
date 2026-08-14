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
import { writeLog, getLocalPlayerName, sendGameProgressMessage } from './common_utils.js'; 
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
    writeLog(supabase, "System", "Init", "アプリケーションの初期化");
    
    await debugSupabaseConnection(supabase);

    currentUserId = await checkExistingLogin(supabase, SEL_G);

    if (currentUserId) {
        writeLog(supabase, "System", "Init", `既存のログインセッションを検出: user_id=${currentUserId}`);
        toggleScreen(true);
        startSubscriptions(supabase, roomId, currentUserId, updateUI);
    } else {
        writeLog(supabase, "System", "Init", "既存のログインセッション無し。ログイン画面を表示");
        toggleScreen(false);
    }
})();

// イベントリスナーの登録
btnLogin?.addEventListener('click', async () => {
    writeLog(supabase, "System", "Action", "「入室する」ボタンが押下されました");
    if (!supabase) return;
    const username = inputUsername?.value.trim();
    if (!username) { 
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

btnRollDice?.addEventListener('click', async () => {
    const playerName = getLocalPlayerName();
    writeLog(supabase, playerName, "Action", "「サイコロ１個」ボタンが押下されました");
    const result = await actionRollDice(supabase, currentUserId, 1);
    if (result && result.error) {
        sendGameProgressMessage(supabase, roomId, playerName, result.error, "actionRollDice");
    } else if (result && result.success) {
        // メッセージを1行に連結
        let msg = `${result.diceVal}の目が出て、${result.posStr}${result.cellName} に移動しました。`;
        if (result.isOpportunity) {
            msg += `${playerName} は「普通の商売」「大きな商売」をひいてください`;
        } else if (result.isDoodad) {
            msg += `カードをただちに処理して下さい。`;
        }
        sendGameProgressMessage(supabase, roomId, playerName, msg, "actionRollDice");
    }
});

btnRollDice2?.addEventListener('click', async () => {
    const playerName = getLocalPlayerName();
    writeLog(supabase, playerName, "Action", "「サイコロ２個」振りました。");
    const result = await actionRollDice(supabase, currentUserId, 2);
    if (result && result.error) {
        sendGameProgressMessage(supabase, roomId, playerName, result.error, "actionRollDice");
    } else if (result && result.success) {
        // メッセージを1行に連結
        let msg = `${result.diceVal}の目が出て、${result.posStr}${result.cellName} に移動しました`;
        if (result.isOpportunity) {
            msg += `<br>${playerName} は、普通の商売、または大きな商売、のどちらかをひいてください`;
        } else if (result.isDoodad) {
            msg += `<br>カードの内容は即座に処理しなければなりません`;
        }
        sendGameProgressMessage(supabase, roomId, playerName, msg, "actionRollDice");
    }
});

btnClaimPaycheck?.addEventListener('click', async () => {
    const playerName = getLocalPlayerName();
    writeLog(supabase, playerName, "Action", "「入金請求」ボタンが押下されました");
    const success = await actionClaimPaycheck(supabase, currentUserId);
    if (success) {
        sendGameProgressMessage(supabase, roomId, playerName, "入金請求しました。", "actionClaimPaycheck");
    }
});

btnEndTurn?.addEventListener('click', async () => {
    const playerName = getLocalPlayerName();
    writeLog(supabase, playerName, "Action", "「次の人へ」ボタンが押下されました");
    await actionEndTurn(supabase, currentUserId);
});

btnCheckCalculations?.addEventListener('click', async () => {
    const playerName = getLocalPlayerName();
    writeLog(supabase, playerName, "Action", "「計算」ボタンが押下されました");
    const result = await actionCheckCalculations(supabase, currentUserId);
    if (result && result.error) {
        sendGameProgressMessage(supabase, roomId, playerName, result.error, "actionCheckCalculations");
    }
});

btnBorrowLoan?.addEventListener('click', async () => {
    const playerName = getLocalPlayerName();
    writeLog(supabase, playerName, "Action", "「銀行借入」ボタンが押下されました");
    const result = await actionBorrowBankLoan(supabase, currentUserId);
    if (result && result.success) {
        sendGameProgressMessage(supabase, roomId, playerName, "銀行借入を行いました。", "actionBorrowBankLoan");
    } else if (result && result.error) {
        sendGameProgressMessage(supabase, roomId, playerName, result.error, "actionBorrowBankLoan");
    }
});

btnPaybackLoan?.addEventListener('click', async () => {
    const playerName = getLocalPlayerName();
    writeLog(supabase, playerName, "Action", "「銀行返済」ボタンが押下されました");
    const result = await actionRepayBankLoan(supabase, currentUserId);
    if (result && result.success) {
        sendGameProgressMessage(supabase, roomId, playerName, "銀行ローンを返済しました。", "actionRepayBankLoan");
    } else if (result && result.error) {
        sendGameProgressMessage(supabase, roomId, playerName, result.error, "actionRepayBankLoan");
    }
});

btnSmallDeal?.addEventListener('click', async () => {
    const playerName = getLocalPlayerName();
    writeLog(supabase, playerName, "Action", "「普通の商売」ボタンが押下されました");
    const success = await actionDrawCard(supabase, currentUserId, 'small_deal');
    if (success) {
        sendGameProgressMessage(supabase, roomId, playerName, `${playerName} は、普通の商売 のカードをひきました`, "actionDrawCard");
    }
});

btnBigDeal?.addEventListener('click', async () => {
    const playerName = getLocalPlayerName();
    writeLog(supabase, playerName, "Action", "「大きい商売」ボタンが押下されました");
    const success = await actionDrawCard(supabase, currentUserId, 'big_deal');
    if (success) {
        sendGameProgressMessage(supabase, roomId, playerName, `${playerName} は、大きな商売 のカードをひきました`, "actionDrawCard");
    }
});

btnOperate?.addEventListener('click', async () => {
    const playerName = getLocalPlayerName();
    writeLog(supabase, playerName, "Action", "「実際に処理する(資産負債)」ボタンが押下されました");
    const result = await actionOperateItem(supabase, currentUserId);
    if (result && result.success) {
        sendGameProgressMessage(supabase, roomId, playerName, `「${result.itemText}」の処理が完了しました。`, "actionOperateItem");
    } else if (result && result.error) {
        sendGameProgressMessage(supabase, roomId, playerName, result.error, "actionOperateItem");
    }
});

btnSellCard?.addEventListener('click', async () => {
    const playerName = getLocalPlayerName();
    writeLog(supabase, playerName, "Action", "「交渉持掛」ボタンが押下されました");

    // 対象のプレイヤー名を取得する処理
    const elTarget = document.getElementById(SEL_G.TRADE.SELECT_TARGET);
    const targetUserId = elTarget ? elTarget.value : null;
    const targetUser = cachedParticipantsList.find(p => p.user_id === targetUserId);
    const targetName = targetUser?.state?.name || "他のプレイヤー";

    const result = await actionProposeTrade(supabase, currentUserId);
    if (result && result.success) {
        sendGameProgressMessage(supabase, roomId, playerName, `${targetName}と交渉中。返答待ちです`, "actionProposeTrade");
    } else if (result && result.error) {
        sendGameProgressMessage(supabase, roomId, playerName, result.error, "actionProposeTrade");
    }
});

btnFastTrack?.addEventListener('click', () => {
    writeLog(supabase, getLocalPlayerName(), "Action", "「ファーストトラック」ボタンが押下されました");
});

btnProcessSelf?.addEventListener('click', async () => {
    const playerName = getLocalPlayerName();
    writeLog(supabase, playerName, "Action", "「処理する」ボタンが押下されました");
    const numInput = document.getElementById(SEL_G.TRADE.NUM_PROCESS_SELF);
    const qty = numInput && !numInput.hidden ? parseInt(numInput.value, 10) || 1 : 1;
    const result = await actionProcessSelf(supabase, currentUserId, qty);
    if (result && result.success) {
        if (result.type === 'charity') {
            sendGameProgressMessage(supabase, roomId, playerName, "寄付しました。サイコロを2個振れます。", "actionProcessSelf");
        } else if (result.type === 'other') {
            sendGameProgressMessage(supabase, roomId, playerName, `「${result.cardTitle}」を適用しました。`, "actionProcessSelf");
        } else {
            const qtyStr = Number(result.qty).toLocaleString();
            sendGameProgressMessage(supabase, roomId, playerName, `「${result.cardTitle}」を ${qtyStr} 個、処理しました。`, "actionProcessSelf");
        }
    } else if (result && result.error) {
        sendGameProgressMessage(supabase, roomId, playerName, result.error, "actionProcessSelf");
    }
});

btnPassCard?.addEventListener('click', async () => {
    const playerName = getLocalPlayerName();
    writeLog(supabase, playerName, "Action", "「パスする」ボタンが押下されました");
    const success = await actionPass(supabase, currentUserId);
    if (success) {
        sendGameProgressMessage(supabase, roomId, playerName, `${playerName} は、パスしました。`, "actionPassCard");
    }
});

btnTradeAccept?.addEventListener('click', async () => {
    const playerName = getLocalPlayerName();
    writeLog(supabase, playerName, "Action", "「承諾」ボタンが押下されました");
    const result = await actionAcceptTrade(supabase, currentUserId);
    if (result && result.success) {
        sendGameProgressMessage(supabase, roomId, playerName, "交渉成立。代金を支払い、カードを獲得しました。", "actionAcceptTrade");
    } else if (result && result.error) {
        sendGameProgressMessage(supabase, roomId, playerName, result.error, "actionAcceptTrade");
    }
});

btnTradeReject?.addEventListener('click', async () => {
    const playerName = getLocalPlayerName();
    writeLog(supabase, playerName, "Action", "「拒否」ボタンが押下されました");
    const result = await actionRejectTrade(supabase, currentUserId);
    if (result && result.success) {
        sendGameProgressMessage(supabase, roomId, playerName, "交渉を拒否しました。", "actionRejectTrade");
    } else if (result && result.error) {
        sendGameProgressMessage(supabase, roomId, playerName, result.error, "actionRejectTrade");
    }
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
