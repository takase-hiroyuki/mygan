// index_state.js
import { renderGuestUI } from './index_ui.js';
import { SEL_G } from './common_dom_selectors.js'; 
import { getLocalPlayerName, insertSystemMessage, displaySystemMessage } from './common_utils.js';

let cachedParticipants = [];
let cachedRoom = null;

// Supabase Realtimeの購読を開始する
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
                await insertSystemMessage(supabase, playerName, "部屋から削除されました。7秒後に画面を再読み込みします。");
                
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
            // 【重要】ここは「DBから受信したログを画面に表示する」だけの受信機のため、
            // 唯一 displaySystemMessage を維持します。
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
        console.error("[CRITICAL_ERROR] 参加者データのフェッチに失敗しました:", resPart.error);
        const playerName = getLocalPlayerName();
        await insertSystemMessage(supabase, playerName, "参加者データの同期に失敗しました。");
        return;
    }
    if (resRoom.error) {
        console.error("[CRITICAL_ERROR] 部屋データのフェッチに失敗しました:", resRoom.error);
        const playerName = getLocalPlayerName();
        await insertSystemMessage(supabase, playerName, "部屋データの同期に失敗しました。");
        return;
    }
    
    if (resPart.data) cachedParticipants = resPart.data;
    if (resRoom.data) cachedRoom = resRoom.data;
    
    // UI描画関数を呼び出し、最新のキャッシュを渡す（ここですべてのボタン制御を決定）
    renderGuestUI(currentUserId, cachedParticipants, cachedRoom, supabase);
}

console.log("【デバッグ】index_state.js が読み込まれました。");
