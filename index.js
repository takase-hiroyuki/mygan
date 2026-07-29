// index.js
import { roomId } from './common_config.js';
import { DOM_SELECTORS } from './common_dom_selectors.js';
import { toggleScreen } from './index_ui.js';
import { initCardEventListeners } from './index_ui_cards.js'; 
import { initSupabaseClient, checkExistingLogin, loginUser } from './index_auth.js';
import { startSubscriptions } from './index_state.js';
import { actionRollDice, actionEndTurn, actionClaimPaycheck, actionCheckCalculations } from './index_actions.js';

let supabase = null;
const SEL_G = DOM_SELECTORS.GUEST;
const inputUsername = document.getElementById(SEL_G.LOGIN.INPUT_USERNAME);
const btnLogin = document.getElementById(SEL_G.LOGIN.BTN_LOGIN);
const btnRollDice = document.getElementById(SEL_G.CONTROLS.BTN_ROLL_DICE);
const btnRollDice2 = document.getElementById(SEL_G.CONTROLS.BTN_ROLL_DICE_2); // ★追加: サイコロ2個用ボタン
const btnClaimPaycheck = document.getElementById(SEL_G.CONTROLS.BTN_CLAIM_PAYCHECK);
const btnEndTurn = document.getElementById(SEL_G.CONTROLS.BTN_END_TURN);
const btnCheckCalculations = document.getElementById(SEL_G.FINANCIALS.BTN_CHECK_CALCULATIONS);

let currentUserId = null;
let isCardListenersReady = false; // イベントリスナーの重複登録を防止するフラグ

// ユーザーID確定後にカードイベントを登録し、DB更新用情報を受け渡す
function setupCardListeners() {
    if (!isCardListenersReady && supabase && currentUserId) {
        initCardEventListeners(supabase, currentUserId);
        isCardListenersReady = true;
    }
}

(async function init() {
    supabase = await initSupabaseClient();
    currentUserId = await checkExistingLogin(supabase, SEL_G);

    if (currentUserId) {
        setupCardListeners(); // 既存ログイン確認後に登録
        toggleScreen(true);
        startSubscriptions(supabase, roomId, currentUserId);
    } else {
        toggleScreen(false);
    }
})();

btnLogin.addEventListener('click', async () => {
    if (!supabase) return;
    const username = inputUsername.value.trim();
    if (!username) { alert('名前を入力してください！'); return; }

    btnLogin.disabled = true;
    const newUserId = await loginUser(supabase, username);
    
    if (newUserId) {
        currentUserId = newUserId;
        setupCardListeners(); // 新規ログイン完了後に登録
        toggleScreen(true);
        startSubscriptions(supabase, roomId, currentUserId);
    } else {
        btnLogin.disabled = false;
    }
});

// イベントリスナーは actions へ処理を委譲するのみ
// ★修正: アクション関数にサイコロの数 (1 または 2) を引数として渡す
btnRollDice?.addEventListener(
    'click', () => actionRollDice(supabase, currentUserId, 1)
);
btnRollDice2?.addEventListener(
    'click', () => actionRollDice(supabase, currentUserId, 2)
);

btnClaimPaycheck?.addEventListener(
    'click', () => actionClaimPaycheck(supabase, currentUserId)
);
btnEndTurn?.addEventListener(
    'click', () => actionEndTurn(supabase, currentUserId)
);
btnCheckCalculations?.addEventListener(
    'click', () => actionCheckCalculations(supabase, currentUserId)
);

console.log("【デバッグ】index.js が読み込まれました。");
