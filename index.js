/*
UIの制御において、複数の場所でボタンのアクティブ・非アクティブを個別に切り替えると、必ず状態の矛盾（バグ）が発生します。システム設計において非常に重要で鋭い視点です。
そのため、本システムでは 「ボタンの操作は直接画面を変更せず、データベース（state）を更新するだけにとどめ、画面の描画は常に最新のデータベースを読み込んで『一箇所』で決定する」 という設計（データ駆動アーキテクチャ）を採用しています。「次の人へ」ボタンの有効・無効を決定する唯一の判定場所は、index_ui.js の renderGuestUI 関数内になります。そこに、ご提示いただいた条件をすべて集約した以下のロジックを配置します。ただし、通信中フラグのためだけに画面全体を描画する関数（renderGuestUI）を呼び直すと、入力欄のフォーカスが外れる、画面がちらつくなどの副作用が発生する。そのため、「通信直前のボタン無効化と、完了後の有効化」に限っては、例外として直接DOMを操作することが実用的な標準手法として広く採用します。

現在、以下の2つの作業が未完了として残っています。
「ファーストトラック」への移行判定バックエンド処理の構築
先ほどフロントエンドに設置したダミーの「ファーストトラックへ移行可能！」ボタン（BTN_FAST_TRACK）を押した際に、実際にプレイヤーの game_phase を "fast_track" に更新し、ファーストトラック用の初期状態（現金のリセット、新しいダイスのルールの適用など）へ移行させるRPCの作成。
市場カード（ID: 122 / 長期金利急落）の特殊売却処理の連携
House（3Br/2Ba）をコスト+$50,000で任意売却するUIダイアログと、それを処理するフロント/バックエンドの連携。

【今後の課題】全員がアクションを完了するまで場に出たカード（Market/Small Deal等）を保持する仕様への改修
1. 現状の課題（Issue）
現在の仕様では、手番プレイヤーが「パス（確認して手番を進める）」を実行すると、即座に場に出ているカードが破棄され、次のプレイヤーへターンが移行してしまう。
これにより、Small DealやMarketのカード（例：「OK4U株の高騰」「アパートの買い取りオファー」など）において、手番以外のプレイヤーが対象資産を保有しており「売却したい」と考えていても、操作する前に画面からカードが消えてしまい、売却機会を逸してしまう不具合（UXの低下）が発生している。

2. 目指すべきゴール（To-Be）
MarketやSmall Dealなど「他プレイヤーも恩恵を受けられるカード」が引かれた場合、「全プレイヤーがアクション（売却処理、またはパス・見送り）を完了したこと」をシステムが検知した時点で、初めてカードを消去し、次のターンへ移行する仕様に変更する。

3. 実装に向けた改修方針（Todo List）
■ バックエンド（Supabase / SQL）の改修

フラグの初期化: カードが引かれた際（draw_card_v2 等）、全プレイヤーの is_action_completed フラグを確実に false にリセットする。

ターン終了条件の変更: pass_and_end_turn_v2 などの手番終了処理において、「手番プレイヤーがパスしたから即終了」ではなく、「全プレイヤーの is_action_completed が true になっているか」を判定するロジックに変更する。

待機状態の管理: 全員が完了していない場合は、ターンを移行させず、自身の is_action_completed だけを true にして待機状態とする処理（例: complete_action_v2 の拡張）を実装する。

■ フロントエンド（JavaScript / UI）の改修

非手番プレイヤーのUI解放: 全体に関係するカードが場に出た際、手番以外のプレイヤーの画面でも「自分の資産を売却する」ボタンや「パス（見送る）」ボタンを有効化し、アクションできるようにする（index_ui_rules.js の改修）。

待機ステータスの表示: 自分がアクションを終えた後、他のプレイヤーの操作を待っている間は、「他のプレイヤーの決断を待っています...」といったUI表示に切り替え、二重操作を防止する。

ホスト向けの強制進行機能（任意）: 離席しているプレイヤーがいた場合にゲームが進行不能になるのを防ぐため、ホスト権限で「強制的に全員パスとみなしてターンを進める」機能の追加を検討する。
*/

// index.js

import { roomId } from './common_config.js';
import { SEL_G } from './common_dom_selectors.js'; 

import { toggleScreen, renderBaseUI } from './index_ui_base.js';
import { applyUIRules } from './index_ui_rules.js';
import { initSupabaseClient, checkExistingLogin, loginUser } from './index_auth.js';
import { startSubscriptions } from './index_state.js'; 
import { insertSystemMessage, writeLog } from './common_utils.js'; // ★ writeLog を追加インポート
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
const btnFastTrack = document.getElementById(SEL_G.FINANCIALS.BTN_FAST_TRACK); 

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
    writeLog(supabase, "System", "UI", "「ログイン」ボタンが押下されました");
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

btnFastTrack?.addEventListener('click', () => {
    writeLog(supabase, "System", "UI", "ファーストトラック移行ボタンが押下されました。(現在はダミーリスナー)");
});

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
