// index.js
import { roomId } from './common_config.js';
import { DOM_SELECTORS } from './common_dom_selectors.js';
import { toggleScreen, disableAllActionButtons } from './index_ui.js';
import { initSupabaseClient, checkExistingLogin, loginUser } from './index_auth.js';
import { startSubscriptions } from './index_state.js';

let supabase = null;
const SEL_G = DOM_SELECTORS.GUEST;
const inputUsername = document.getElementById(SEL_G.LOGIN.INPUT_USERNAME);
const btnLogin = document.getElementById(SEL_G.LOGIN.BTN_LOGIN);
const btnRollDice = document.getElementById(SEL_G.CONTROLS.BTN_ROLL_DICE);
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

btnRollDice.addEventListener('click', async () => {
    if (!supabase) return;
    
    // 【警告】現状のクライアント側計算はデータ整合性の観点から不適切である。
    // 次ステップ（index_actions.jsへの分離）にて、この処理を削除し、
    // サーバーサイドRPC（roll_dice_and_move等）の呼び出しへ完全に置き換える。
    const diceRoll = Math.floor(Math.random() * 6) + 1;
    
    // 一時的な現在位置の取得（次ステップで廃止）
    const { data: record } = await supabase.from('participants').select('state').eq('user_id', currentUserId).single();
    const oldPos = record?.state?.position ?? 0;
    const newPos = (oldPos + diceRoll) % 24;

    const patch = { position: newPos, last_dice: diceRoll };
    await supabase.rpc('merge_participant_state', { target_user_id: currentUserId, state_patch: patch });
});

btnEndTurn.addEventListener('click', async () => {
    if (!supabase) return;

    disableAllActionButtons();
    await supabase.rpc('pass_and_end_turn', { p_room_id: roomId, p_user_id: currentUserId });
});
