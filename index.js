/*
UIの制御において、複数の場所でボタンのアクティブ・非アクティブを個別に切り替えると、必ず状態の矛盾（バグ）が発生します。システム設計において非常に重要で鋭い視点です。
そのため、本システムでは 「ボタンの操作は直接画面を変更せず、データベース（state）を更新するだけにとどめ、画面の描画は常に最新のデータベースを読み込んで『一箇所』で決定する」 という設計（データ駆動アーキテクチャ）を採用しています。「次の人へ」ボタンの有効・無効を決定する唯一の判定場所は、index_ui.js の renderGuestUI 関数内になります。そこに、ご提示いただいた条件をすべて集約した以下のロジックを配置します。ただし、通信中フラグのためだけに画面全体を描画する関数（renderGuestUI）を呼び直すと、入力欄のフォーカスが外れる、画面がちらつくなどの副作用が発生する。そのため、「通信直前のボタン無効化と、完了後の有効化」に限っては、例外として直接DOMを操作することが実用的な標準手法として広く採用します。

ご提示いただいた7枚のカードの内容と、「これらに対して特別な処理（独立したRPC関数など）を用意することで、既存の汎用関数の例外処理をなくし、簡潔でエラーに強くする」というあなたのお考えについて回答します。
結論から申し上げますと、あなたの設計方針は非常に妥当であり、ゲームシステムのアーキテクチャとして大正解です。
通常の「買う」「売る」といった基本RPCの中に、これらの特殊ルール（「特定の物件を持っている場合のみ罰金」「全員のキャッシュフローが一斉に上がる」など）を無理やり組み込むと、条件分岐（If文）が肥大化し、いわゆる「スパゲッティコード」となって深刻なバグの温床になります。例外は例外として外に切り出すべきです。
ただし、「7つのカードそれぞれに1つずつ（計7つ）の専用RPCを作る」のは少し過剰かもしれません。今後の拡張性も考慮した改善点（アーキテクチャの提案）を以下にまとめます。

改善案：『アクションルール駆動（データ駆動）』による集約
専用RPCを7つ作る代わりに、これら7枚のカードを4つのパターンに分類し、カードの action_rule (JSON) に条件を定義して、それを処理する少数のRPC（または統合された1つの特殊処理RPC）を作成することをお勧めします。

パターン1：条件付き罰金（ID: 13, 85, 65）
特徴: 手番プレイヤーのみ対象。特定の資産を持っているかチェックし、持っていれば罰金を払う。
action_rule の設計例 (ID:65):
{ "type": "conditional_penalty", "target_asset": "Plex(8)", "amount": 2000, "max_charge": "once" }
処理: 該当アセットの保有数をカウントし、条件を満たせば所持金を減らすRPC。

パターン2：資産の強制没収（ID: 121）
特徴: 手番プレイヤーのみ対象。特定の資産（House）をすべて失い、それに伴うキャッシュフローも失う。
action_rule の設計例:
{ "type": "foreclosure", "target_asset": "House" }
処理: 該当プレイヤーの資産リストから House を全削除し、財務諸表（総収入・不労所得など）を再計算するRPC。

パターン3：条件付き全体バフ（ID: 132, 133）
特徴: 全プレイヤーが対象。特定の資産（S-Comp, W-Comp）を持っている全員のキャッシュフローを上乗せする。
action_rule の設計例 (ID:132):
{ "type": "global_cf_boost", "target_asset": ["S-Comp", "W-Comp"], "boost_amount": 400 }
処理: 部屋内の全プレイヤーをループし、該当資産を持っていればその資産の passive_income を書き換え、財務諸表を再計算するRPC。

パターン4：特殊価格での任意売却（ID: 122）
特徴: 自動処理ではない。手番プレイヤーが「通常とは異なる計算式（コスト + $50,000）」で物件を売る権利を得る。
action_rule の設計例:
{ "type": "special_sell_offer", "target_asset": "House", "price_formula": "cost_plus_50000" }
処理: これだけは自動RPCではなく、フロントエンド（JS）側で「売却ダイアログ」を出し、売る選択をした場合のみ、特別価格を引数にして既存の sell_asset RPCを叩くように設計するのがスマートです。

次のステップへの提案
既存の汎用RPC（buy_asset, sell_asset）を汚さないというあなたの素晴らしい方針を維持したまま、以下の手順で進めるのが最も美しい実装になります。
上記7枚のカードの action_rule (JSON列) に、上記のような「処理パターン」と「金額・対象」のパラメータを UPDATE 文で書き込む。
データベース側に execute_special_event(p_room_id, p_user_id, p_card_id) というような、JSONを読み取って処理を分岐させる1つの統合イベント処理RPCを作成する。
フロントエンド（participant.js）では、カードを引いた際に asset_type が other であれば、その統合RPCを呼び出す（ID122のみUI操作に回す）。
このアプローチであれば、今後似たような特殊カードが増えても、プログラムを一切書き直さずにデータベース（JSON）の追加だけで対応できるようになります。
*/

// index.js

import { roomId } from './common_config.js';
import { SEL_G } from './common_dom_selectors.js'; 
import { toggleScreen } from './index_ui.js';

import { initSupabaseClient, checkExistingLogin, loginUser } from './index_auth.js';
import { startSubscriptions } from './index_state.js'; 
import { insertSystemMessage } from './common_utils.js'; 
import { actionRollDice, actionEndTurn, actionDrawCard, actionPass } from './index_actions_turn.js';
import { actionClaimPaycheck, actionCheckCalculations, actionOperateItem } from './index_actions_finance.js'; 
import { actionBorrowBankLoan, actionRepayBankLoan } from './index_actions_loan.js';
import { actionProposeTrade, actionAcceptTrade, actionRejectTrade } from './index_actions_trade.js'; // ★修正: 承諾と拒否を追加

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

// -----------------------------------------------------------------------------
// カードドロー用のボタン
// -----------------------------------------------------------------------------
const btnSmallDeal = document.getElementById(SEL_G.CARD.BTN_SMALL_DEAL);
const btnBigDeal = document.getElementById(SEL_G.CARD.BTN_BIG_DEAL);

// 新しい取引・処理用のボタン
const btnOperate = document.getElementById(SEL_G.FINANCIALS.BTN_OPERATE);
const btnSellCard = document.getElementById(SEL_G.TRADE.BTN_SELL);
const btnProcessSelf = document.getElementById(SEL_G.TRADE.BTN_PROCESS_SELF);
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

// -----------------------------------------------------------------------------
// 商売マスのカードドロー処理
// -----------------------------------------------------------------------------
btnSmallDeal?.addEventListener('click', () => {
    actionDrawCard(supabase, currentUserId, 'small_deal');
});

btnBigDeal?.addEventListener('click', () => {
    actionDrawCard(supabase, currentUserId, 'big_deal');
});

// ============================================================================
// アイテム処理およびトレード用のリスナー
// ============================================================================

btnOperate?.addEventListener('click', () => {
    actionOperateItem(supabase, currentUserId);
});

btnSellCard?.addEventListener('click', () => {
    actionProposeTrade(supabase, currentUserId);
});

btnProcessSelf?.addEventListener('click', async () => {
    await actionPass(supabase, currentUserId);
});

// ★ 修正：承諾・拒否ボタンに実際の関数を紐付け
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

console.log("[デバッグ] index.js が正常にロードされました。");
