// index_state.js
import { renderGuestUI } from './index_ui.js';
import { DOM_SELECTORS } from './common_dom_selectors.js';
import { setButtonActive, OPPORTUNITY_CELLS, DOODAD_CELLS, MARKET_CELLS } from './common_utils.js';        

let cachedParticipants = [];
let cachedRoom = null;

/**
 * プレイヤーの状態（フラグなど）に基づいて、アクションボタンの有効/無効を厳格に一元管理する
 */
function updateActionButtonsState(playerState, isMyTurn) {
    const flags = playerState.flags || {};
    const position = playerState.position || 0;
    
    // 必要なフラグの取得 (最新の整数値スキーマに対応)
    const hasRolledDice = !!flags.has_rolled_dice;
    const isCalculating = !!flags.is_calculating;
    const isNegativeCashFlow = !!flags.is_negative_cash_flow;
    const isActionCompleted = !!flags.is_action_completed;
    const charityTurnsLeft = parseInt(flags.charity_turns_left || 0, 10);
    const downsizedTurnsLeft = parseInt(flags.downsized_turns_left || 0, 10);
    const pendingPaydays = parseInt(flags.pending_paydays || 0, 10);

    const isDownsized = downsizedTurnsLeft > 0;
    const SEL = DOM_SELECTORS.GUEST.CONTROLS;

    const isCardCell = OPPORTUNITY_CELLS.includes(position) || DOODAD_CELLS.includes(position) || MARKET_CELLS.includes(position);

    // 1. サイコロ1個を振るボタンの制御
    const canRollDice1 = isMyTurn && !hasRolledDice && !isCalculating && !isDownsized;
    setButtonActive(SEL.BTN_ROLL_DICE, canRollDice1);

    // 2. サイコロ2個を振るボタンの制御
    const canRollDice2 = canRollDice1 && (charityTurnsLeft > 0);
    setButtonActive(SEL.BTN_ROLL_DICE_2, canRollDice2);

    // 3. 給料を受け取る（または支払う）ボタンの制御
    const canClaimPaycheck = isMyTurn && (pendingPaydays > 0);
    setButtonActive(SEL.BTN_CLAIM_PAYCHECK, canClaimPaycheck);

    // マイナスキャッシュフロー時の支払い義務判定
    const hasMandatoryPaycheck = (pendingPaydays > 0) && isNegativeCashFlow;

    // 4. ターン終了ボタンの制御
    // 支払い義務（hasMandatoryPaycheck）がある場合、またはアクション未完了時は終了不可
    const canEndTurn = isMyTurn && 
                       (hasRolledDice || isDownsized) && 
                       !isCalculating && 
                       (!isCardCell || isActionCompleted) &&
                       !hasMandatoryPaycheck;
                       
    setButtonActive(SEL.BTN_END_TURN, canEndTurn);
    
    console.log(`[DEBUG_STATE] Buttons Update: isMyTurn=${isMyTurn}, Roll1=${canRollDice1}, Roll2=${canRollDice2}, Paycheck=${canClaimPaycheck}, End=${canEndTurn}, Downsized=${isDownsized}, isCardCell=${isCardCell}, isActionCompleted=${isActionCompleted}, hasMandatoryPaycheck=${hasMandatoryPaycheck}`);
}

/**
 * Supabase Realtimeの購読を開始する
 */
export function startSubscriptions(supabase, roomId, currentUserId) {
    if (!supabase) return;

    supabase.channel('public:participants').on('postgres_changes', {
        event: '*', schema: 'public', table: 'participants' 
    }, async (payload) => {
        // 対象ユーザーが削除（キック）された場合、自身であれば即座に強制ログアウトする
        if (payload.eventType === 'DELETE' && payload.old) {
            if (payload.old.user_id === currentUserId) {
                console.warn("[CRITICAL_WARNING] 自身のアカウントが部屋から削除されました。強制ログアウトします。");
                localStorage.removeItem('user_id');
                localStorage.removeItem('player_name');
                window.location.reload();
                return;
            }
            
            // 部屋の参加者が0になった場合の処理
            const { data } = await supabase.from('participants').select('id').eq('room_id', roomId);
            if (!data || data.length === 0) {
                localStorage.removeItem('user_id');
                localStorage.removeItem('player_name');
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
    
    if (resPart.error) {
        console.error("[CRITICAL_ERROR] 参加者データのフェッチに失敗しました:", resPart.error);
        return;
    }
    if (resRoom.error) {
        console.error("[CRITICAL_ERROR] 部屋データのフェッチに失敗しました:", resRoom.error);
        return;
    }
    
    if (resPart.data) cachedParticipants = resPart.data;
    if (resRoom.data) cachedRoom = resRoom.data;
    
    const myParticipantRecord = cachedParticipants.find(p => p.user_id === currentUserId);
    
    if (myParticipantRecord) {
        console.log("[DEBUG_STATE] UI描画直前: state.financials:", JSON.stringify(myParticipantRecord.state?.financials, null, 2));
    }

    // UI描画関数を呼び出し、最新のキャッシュを渡す
    renderGuestUI(currentUserId, cachedParticipants, cachedRoom);

    // 描画後にボタンの厳格な状態制御を実行
    if (myParticipantRecord && cachedRoom) {
        const playerState = myParticipantRecord.state || {};
        const isMyTurn = (cachedRoom.current_turn_user_id === currentUserId);
        updateActionButtonsState(playerState, isMyTurn);
    }
}

console.log("【デバッグ】index_state.js が読み込まれました。");
