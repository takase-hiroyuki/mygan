// index_state.js
import { renderGuestUI } from './index_ui.js';
import { DOM_SELECTORS } from './common_dom_selectors.js'; // ★追加
import { setButtonActive } from './common_utils.js';       // ★追加

let cachedParticipants = [];
let cachedRoom = null;

/**
 * ★追加: プレイヤーの状態（フラグなど）に基づいて、アクションボタンの有効/無効を厳格に制御する
 */
function updateActionButtonsState(playerState, isMyTurn) {
    const flags = playerState.flags || {};
    
    // 必要なフラグの取得
    const hasRolledDice = !!flags.has_rolled_dice;
    const isCalculating = !!flags.is_calculating;
    const isNegativeCashFlow = !!flags.is_negative_cash_flow;

    const SEL = DOM_SELECTORS.GUEST.CONTROLS;

    // 1. サイコロを振るボタンの制御
    // 条件: 自分のターン && まだサイコロを振っていない && 計算中ではない
    const canRollDice = isMyTurn && !hasRolledDice && !isCalculating;
    setButtonActive(SEL.BTN_ROLL_DICE, canRollDice);

    // 2. ターン終了ボタンの制御
    // 条件: 自分のターン && サイコロを振った && 計算中ではない && マイナスキャッシュフローではない
    const canEndTurn = isMyTurn && hasRolledDice && !isCalculating && !isNegativeCashFlow;
    setButtonActive(SEL.BTN_END_TURN, canEndTurn);
}

/**
 * Supabase Realtimeの購読を開始する
 */
export function startSubscriptions(supabase, roomId, currentUserId) {
    if (!supabase) return;

    supabase.channel('public:participants').on('postgres_changes', {
        event: '*', schema: 'public', table: 'participants' 
    }, async (payload) => {
        if (payload.eventType === 'DELETE') {
            const { data } = await supabase.from('participants').select('id').eq('room_id', roomId);
            if (!data || data.length === 0) {
                localStorage.clear();
                window.location.reload();
                return;
            }
        }
        fetchAndRender(supabase, roomId, currentUserId);
    }).subscribe();

    supabase.channel('public:rooms').on('postgres_changes', { 
        event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` 
    }, () => {
        fetchAndRender(supabase, roomId, currentUserId);
    }).subscribe();

    fetchAndRender(supabase, roomId, currentUserId);
}

/**
 * データベースから最新状態を取得し、キャッシュを更新して画面を描画する
 */
export async function fetchAndRender(supabase, roomId, currentUserId) {
    if (!supabase) return;
    const [resPart, resRoom] = await Promise.all([
        supabase.from('participants').select('*').eq('room_id', roomId).order('id', { ascending: true }),
        supabase.from('rooms').select('*').eq('id', roomId).maybeSingle()
    ]);
    
    if (resPart.data) cachedParticipants = resPart.data;
    if (resRoom.data) cachedRoom = resRoom.data;
    
    // 描画関数を呼び出し、最新のキャッシュを渡す
    renderGuestUI(currentUserId, cachedParticipants, cachedRoom);

    // ★追加: 描画後にボタンの厳格な状態制御を実行
    const myParticipantRecord = cachedParticipants.find(p => p.user_id === currentUserId);
    if (myParticipantRecord && cachedRoom) {
        const playerState = myParticipantRecord.state || {};
        const isMyTurn = (cachedRoom.current_turn_user_id === currentUserId);
        updateActionButtonsState(playerState, isMyTurn);
    }
}

console.log("【デバッグ】index_state.js が読み込まれました。");
