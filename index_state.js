// index_state.js
import { SEL_G } from './common_dom_selectors.js'; 
import { getLocalPlayerName, displayGameProgressMessage, resetMessageDisplayState, writeLog, sendGameProgressMessage } from './common_utils.js';

let cachedParticipants = [];
let cachedRoom = null;
let _onRenderCallback = null; 
let previousTurnUserId = null;

export function startSubscriptions(supabase, roomId, currentUserId, onRender) {
    if (!supabase) return;
    
    _onRenderCallback = onRender;

    supabase.channel('public:participants').on('postgres_changes', {
        event: '*', schema: 'public', table: 'participants' 
    }, async (payload) => {
        if (payload.eventType === 'DELETE' && payload.old) {
            if (payload.old.user_id === currentUserId) {
                const playerName = getLocalPlayerName();
                writeLog(supabase, "System", "State Warning", "自身のアカウントが部屋から削除されました。強制ログアウトします。");
                
                sendGameProgressMessage(supabase, roomId, "システム", `${playerName} が部屋から削除されました。`, "startSubscriptions");
                
                localStorage.removeItem('user_id');
                localStorage.removeItem('player_name');
                
                setTimeout(() => {
                    window.location.reload();
                }, 10000);
                return;
            }
            
            const { data } = await supabase.from('participants').select('id').eq('room_id', roomId);
            if (!data || data.length === 0) {
                const playerName = getLocalPlayerName();
                writeLog(supabase, "System", "State", "部屋の参加者が0になったため退出処理を行います。");
                
                localStorage.removeItem('user_id');
                localStorage.removeItem('player_name');
                
                setTimeout(() => {
                    window.location.reload();
                }, 7000);
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

    supabase.channel(`room_broadcast_${roomId}`)
        .on('broadcast', { event: 'progress_update' }, (payload) => {
            if (payload.payload && payload.payload.target && payload.payload.body) {
                displayGameProgressMessage(payload.payload.target, payload.payload.body, payload.payload.funcName);
            }
        })
        .subscribe();

    fetchAndRender(supabase, roomId, currentUserId);
}

export async function fetchAndRender(supabase, roomId, currentUserId) {
    if (!supabase) return;
    
    const [resPart, resRoom] = await Promise.all([
        supabase.from('participants').select('*').eq('room_id', roomId).order('id', { ascending: true }),
        supabase.from('rooms').select('*').eq('id', roomId).maybeSingle()
    ]);
    
    if (resPart.error) {
        writeLog(supabase, "System", "State Error", `参加者データのフェッチに失敗しました: ${JSON.stringify(resPart.error)}`);
        const playerName = getLocalPlayerName();
        sendGameProgressMessage(supabase, roomId, playerName, "参加者データの同期に失敗しました。", "fetchAndRender");
        return;
    }
    if (resRoom.error) {
        writeLog(supabase, "System", "State Error", `部屋データのフェッチに失敗しました: ${JSON.stringify(resRoom.error)}`);
        const playerName = getLocalPlayerName();
        sendGameProgressMessage(supabase, roomId, playerName, "部屋データの同期に失敗しました。", "fetchAndRender");
        return;
    }
    
    if (resPart.data) cachedParticipants = resPart.data;
    if (resRoom.data) {
        cachedRoom = resRoom.data;

        const newTurnUserId = cachedRoom.current_turn_user_id;
        if (newTurnUserId && newTurnUserId !== previousTurnUserId) {
            resetMessageDisplayState();
            const turnUser = cachedParticipants.find(p => p.user_id === newTurnUserId);
            const turnUserName = turnUser?.state?.name || "プレイヤー";
            displayGameProgressMessage("システム", `${turnUserName} の番になりました。`, "fetchAndRender");
            previousTurnUserId = newTurnUserId;
        }
    }
    
    if (_onRenderCallback) {
        _onRenderCallback(currentUserId, cachedParticipants, cachedRoom);
    }
}

console.log("【残す】index_state.js が読み込まれました。");
