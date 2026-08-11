// index_state.js
import { SEL_G } from './common_dom_selectors.js'; 
import { getLocalPlayerName, insertSystemMessage, displaySystemMessage, writeLog } from './common_utils.js'; // ★ writeLog を追加

let cachedParticipants = [];
let cachedRoom = null;
let _onRenderCallback = null; 

// Supabase Realtimeの購読を開始する
export function startSubscriptions(supabase, roomId, currentUserId, onRender) {
    if (!supabase) return;
    
    _onRenderCallback = onRender;

    // 参加者データの変更監視
    supabase.channel('public:participants').on('postgres_changes', {
        event: '*', schema: 'public', table: 'participants' 
    }, async (payload) => {
        if (payload.eventType === 'DELETE' && payload.old) {
            if (payload.old.user_id === currentUserId) {
                const playerName = getLocalPlayerName();
                writeLog(supabase, "System", "State Warning", "自身のアカウントが部屋から削除されました。強制ログアウトします。");
                await insertSystemMessage(supabase, playerName, "部屋から削除されました。7秒後に画面を再読み込みします。");
                
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
                await insertSystemMessage(supabase, playerName, "部屋の参加者が0になったため退出処理を行います。");
                
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

    // 部屋データの変更監視
    supabase.channel('public:rooms').on('postgres_changes', { 
        event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` 
    }, () => {
        fetchAndRender(supabase, roomId, currentUserId);
    }).subscribe();

    // game_logs テーブルへの INSERT 監視
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

// データベースから最新状態を取得し、キャッシュを更新して画面を描画する
export async function fetchAndRender(supabase, roomId, currentUserId) {
    if (!supabase) return;
    
    const [resPart, resRoom] = await Promise.all([
        supabase.from('participants').select('*').eq('room_id', roomId).order('id', { ascending: true }),
        supabase.from('rooms').select('*').eq('id', roomId).maybeSingle()
    ]);
    
    if (resPart.error) {
        writeLog(supabase, "System", "State Error", `参加者データのフェッチに失敗しました: ${JSON.stringify(resPart.error)}`);
        const playerName = getLocalPlayerName();
        await insertSystemMessage(supabase, playerName, "参加者データの同期に失敗しました。");
        return;
    }
    if (resRoom.error) {
        writeLog(supabase, "System", "State Error", `部屋データのフェッチに失敗しました: ${JSON.stringify(resRoom.error)}`);
        const playerName = getLocalPlayerName();
        await insertSystemMessage(supabase, playerName, "部屋データの同期に失敗しました。");
        return;
    }
    
    if (resPart.data) cachedParticipants = resPart.data;
    if (resRoom.data) cachedRoom = resRoom.data;
    
    if (_onRenderCallback) {
        _onRenderCallback(currentUserId, cachedParticipants, cachedRoom);
    }
}

console.log("【残す】index_state.js が読み込まれました。");
