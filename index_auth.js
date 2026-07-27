// index_auth.js
import { roomId, SUPABASE_URL, SUPABASE_KEY } from './common_config.js';
import { waitForSupabase, getInitialRegistrationState } from './common_utils.js';

/**
 * Supabaseクライアントの初期化
 */
export async function initSupabaseClient() {
    const supabaseGlobal = await waitForSupabase();
    return supabaseGlobal.createClient(SUPABASE_URL, SUPABASE_KEY);
}

/**
 * 既存のログインセッションが存在するか確認する
 */
export async function checkExistingLogin(supabase, guestSelectors) {
    const currentUserId = localStorage.getItem('user_id');
    const storedName = localStorage.getItem('player_name');
    
    const elStorageId = document.getElementById(guestSelectors.DEBUG.STORAGE_ID);
    const elStorageName = document.getElementById(guestSelectors.DEBUG.STORAGE_NAME);
    const elRoomId = document.getElementById(guestSelectors.STATUS.ROOM_ID);

    if (elStorageId) elStorageId.textContent = currentUserId || "未定義";
    if (elStorageName) elStorageName.textContent = storedName || "未定義";
    if (elRoomId) elRoomId.textContent = roomId;

    if (currentUserId) {
        const { data } = await supabase.from('participants')
            .select('*')
            .eq('room_id', roomId)
            .eq('user_id', currentUserId)
            .maybeSingle();
        
        if (data) return currentUserId;
    }
    return null;
}

/**
 * 新規ログイン（入室）処理を実行する
 */
export async function loginUser(supabase, username) {
    const { data: roomCheck } = await supabase.from('rooms').select('game_state').eq('id', roomId).maybeSingle();
    if (roomCheck?.game_state?.status && roomCheck.game_state.status !== 'waiting') {
        alert('ゲームが既に開始されているか終了しているため、入室できません。');
        return null;
    }

    const currentUserId = localStorage.getItem('user_id') || 'user_' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem('user_id', currentUserId);
    localStorage.setItem('player_name', username);
    
    const initialRegistrationState = getInitialRegistrationState(username);
    
    const { error } = await supabase.from('participants').insert(
        [{ room_id: roomId, user_id: currentUserId, state: initialRegistrationState }]
    );
    
    if (error) {
        alert('送信に失敗しました。');
        return null;
    }
    return currentUserId;
}

console.log("【デバッグ】index_auth.js が読み込まれました。");
