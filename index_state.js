// index_state.js
import { renderGuestUI } from './index_ui.js';

let cachedParticipants = [];
let cachedRoom = null;

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
}

console.log("【デバッグ】index_state.js が読み込まれました。");
