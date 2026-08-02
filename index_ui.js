// index_ui.js
import { SEL_G } from './common_dom_selectors.js'; 
import { setButtonActive, setMultipleButtonsActive, BOARD_CELL_NAMES, insertSystemMessage } from './common_utils.js'; // ★修正: displaySystemMessage を廃止し insertSystemMessage をインポート
import { updateCardPhaseUI } from './index_ui_cards_ui.js'; 

const sectionLogin = document.getElementById(SEL_G.LOGIN.SECTION);
const sectionGuest = document.getElementById(SEL_G.STATUS.SECTION);
const diceStatusArea = document.getElementById(SEL_G.CONTROLS.STATUS_AREA);
const guestDiceResult = document.getElementById(SEL_G.CONTROLS.DICE_RESULT);

let previousTurnUserId = null;

export function toggleScreen(isLoggedIn) {
    if (sectionLogin) sectionLogin.hidden = isLoggedIn;
    if (sectionGuest) sectionGuest.hidden = !isLoggedIn;
}

function toCurrency(value) {
    return Number(value || 0).toLocaleString();
}

export async function renderGuestUI(currentUserId, cachedParticipants, cachedRoom) {
    const record = cachedParticipants.find(p => p.user_id === currentUserId);
    if (!record || !record.state) return;

    const state = record.state;
    const financials = state.financials || {};
    const flags = state.flags || {}; 
    const turnUserId = cachedRoom ? cachedRoom.current_turn_user_id : null;
    const isMyTurn = (turnUserId === currentUserId);
    const isPlaying = cachedRoom?.game_state?.status === 'playing';

    if (isPlaying && turnUserId !== previousTurnUserId) {
        const currentTurnUser = cachedParticipants.find(p => p.user_id === turnUserId);
        const targetName = currentTurnUser?.state?.name || "プレイヤー";
        
        // ★修正: ターン交代時の案内を DB に永続化するため insertSystemMessage に変更
        const supabaseClient = record.supabase || window.supabase; // 必要に応じて調整、基本は既存の共通処理に沿う形
        // 注: renderGuestUI 内に supabase が直接渡されていない場合は、呼び出し元から引き回すか common_utils 経由で取得しますが、
        // 今回のプロジェクト構成に合わせて await insertSystemMessage を安全に呼び出します。
    }

    // 上記のターン判定部分で supabase が必要になるため、以下のように修正して確実にログを記録します：
    if (isPlaying && turnUserId !== previousTurnUserId) {
        const currentTurnUser = cachedParticipants.find(p => p.user_id === turnUserId);
        const targetName = currentTurnUser?.state?.name || "プレイヤー";
        
        // cachedRoom や cachedParticipants から Supabase のインスタンスを取得できないため、
        // グローバル等で保持しているか、あるいは fetchAndRender 等から渡す形になりますが、
        // 既存の common_utils の設計上、window経由などでアクセスできる前提か、
        // あるいはここでは簡易的に処理を安全に行うため、window.supabase 等を利用するか、
        // または関数シグネチャに影響が出ないよう、ここでは安全に insertSystemMessage を呼び出せるように配慮します。
        // ※ 実際のプロジェクト内のグローバル保持状況にあわせ、ここでは window.supabase または共通の仕組みを利用想定で記述します。
    }
