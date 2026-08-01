// index_state.js
import { renderGuestUI } from './index_ui.js';
import { DOM_SELECTORS } from './common_dom_selectors.js';
import { setButtonActive, OPPORTUNITY_CELLS, DOODAD_CELLS, MARKET_CELLS } from './common_utils.js';

let cachedParticipants = [];
let cachedRoom = null;

/**
 * 画面（DOM）から現在のプレイヤー名を取得するヘルパー関数
 */
function getLocalPlayerName() {
    const nameEl = document.getElementById(DOM_SELECTORS.GUEST.STATUS.NAME);
    return (nameEl && nameEl.textContent !== '未定') ? nameEl.textContent : 'プレイヤー';
}

/**
 * システムメッセージをDOMのテーブルに追記する関数
 * @param {string} target - メッセージの宛先（1番目のtd用）
 * @param {string} body - メッセージ本文（2番目のtd用）
 */
export function displaySystemMessage(target, body) {
    const tbody = document.getElementById(DOM_SELECTORS.GUEST.MESSAGE.TABLE_BODY);
    if (!tbody) {
        console.warn("[WARNING] message-table-body が見つかりません。メッセージの表示をスキップします。");
        return;
    }

    const tr = document.createElement('tr');
    
    const tdTarget = document.createElement('td');
    tdTarget.textContent = target;
    
    const tdBody = document.createElement('td');
    tdBody.textContent = body;
    
    tr.appendChild(tdTarget);
    tr.appendChild(tdBody);
    
    // 古いログが上になり、最新ログが下に追加されていく
    tbody.appendChild(tr);

    // スクロールコンテナの最下部へ自動スクロール
    const scrollContainer = tbody.parentElement.parentElement;
    if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }

    console.log(`[SYSTEM_MESSAGE] ${target} / ${body}`);
}

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

    // 参加者データの変更監視
    supabase.channel('public:participants').on('postgres_changes', {
        event: '*', schema: 'public', table: 'participants' 
    }, async (payload) => {
        // 対象ユーザーが削除（キック）された場合、自身であれば強制ログアウトする
        if (payload.eventType === 'DELETE' && payload.old) {
            if (payload.old.user_id === currentUserId) {
                const playerName = getLocalPlayerName();
                console.warn("[CRITICAL_WARNING] 自身のアカウントが部屋から削除されました。強制ログアウトします。");
                displaySystemMessage(playerName, "部屋から削除されました。10秒後に画面を再読み込みします。");
                
                localStorage.removeItem('user_id');
                localStorage.removeItem('player_name');
                
                setTimeout(() => {
                    window.location.reload();
                }, 10000);
                return;
            }
            
            // 部屋の参加者が0になった場合の処理
            const { data } = await supabase.from('participants').select('id').eq('room_id', roomId);
            if (!data || data.length === 0) {
                const playerName = getLocalPlayerName();
                displaySystemMessage(playerName, "部屋の参加者が0になったため退出処理を行います。");
                
                localStorage.removeItem('user_id');
                localStorage.removeItem('player_name');
                
                setTimeout(() => {
                    window.location.reload();
                }, 10000);
                return;
            }
        }
        fetchAndRender(supabase, roomId, currentUserId);
    }).subscribe();

    // 部屋データの変更監視
    supabase.channel('public:rooms').on('postgres_changes', { 
        event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` 
    }, () => {
        fetchAndRender(supabase, roomId, currentUserId);
    }).subscribe();

    // ★追加: game_logs テーブルへの INSERT 監視
    supabase.channel('public:game_logs').on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'game_logs', filter: `room_id=eq.${roomId}`
    }, (payload) => {
        const logData = payload.new;
        if (logData && logData.target && logData.body) {
            displaySystemMessage(logData.target, logData.body);
        }
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
        const playerName = getLocalPlayerName();
        displaySystemMessage(playerName, "参加者データの同期に失敗しました。");
        return;
    }
    if (resRoom.error) {
        console.error("[CRITICAL_ERROR] 部屋データのフェッチに失敗しました:", resRoom.error);
        const playerName = getLocalPlayerName();
        displaySystemMessage(playerName, "部屋データの同期に失敗しました。");
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
