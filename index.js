// index.js
import { roomId } from './common_config.js';
import { DOM_SELECTORS } from './common_dom_selectors.js';
import { toggleScreen } from './index_ui.js';
import { initSupabaseClient, checkExistingLogin, loginUser } from './index_auth.js';
import { startSubscriptions } from './index_state.js';
import { actionRollDice, actionEndTurn, actionClaimPaycheck } from './index_actions.js';

let supabase = null;
const SEL_G = DOM_SELECTORS.GUEST;
const inputUsername = document.getElementById(SEL_G.LOGIN.INPUT_USERNAME);
const btnLogin = document.getElementById(SEL_G.LOGIN.BTN_LOGIN);
const btnRollDice = document.getElementById(SEL_G.CONTROLS.BTN_ROLL_DICE);
const btnClaimPaycheck = document.getElementById(SEL_G.CONTROLS.BTN_CLAIM_PAYCHECK);
const btnEndTurn = document.getElementById(SEL_G.CONTROLS.BTN_END_TURN);

let currentUserId = null;

(async function init() {
    supabase = await initSupabaseClient();
    currentUserId = await checkExistingLogin(supabase, SEL_G);

    if (currentUserId) {
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
        toggleScreen(true);
        startSubscriptions(supabase, roomId, currentUserId);
    } else {
        btnLogin.disabled = false;
    }
});

// イベントリスナーは actions へ処理を委譲するのみ
btnRollDice.addEventListener(
    'click', () => actionRollDice(supabase, currentUserId)
);
btnClaimPaycheck.addEventListener(
    'click', () => actionClaimPaycheck(supabase, currentUserId)
);
btnEndTurn.addEventListener(
    'click', () => actionEndTurn(supabase, currentUserId)
);

console.log("【デバッグ】index.js が読み込まれました。");
