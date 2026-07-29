// index_auth.js
import { roomId, SUPABASE_URL, SUPABASE_KEY } from './common_config.js';
import { waitForSupabase, getInitialRegistrationState } from './common_utils.js';

/**
 * Supabaseクライアントの初期化
 */
export async function initSupabaseClient() {
    console.log("[DEBUG-AUTH] initSupabaseClient 実行");
    const supabaseGlobal = await waitForSupabase();
    return supabaseGlobal.createClient(SUPABASE_URL, SUPABASE_KEY);
}

/**
 * 既存のログインセッションが存在するか確認する
 */
export async function checkExistingLogin(supabase, guestSelectors) {
    console.log("[DEBUG-AUTH] checkExistingLogin 実行");
    const currentUserId = localStorage.getItem('user_id');
    const storedName = localStorage.getItem('player_name');
    
    const elStorageId = document.getElementById(guestSelectors.DEBUG.STORAGE_ID);
    const elStorageName = document.getElementById(guestSelectors.DEBUG.STORAGE_NAME);
    const elRoomId = document.getElementById(guestSelectors.STATUS.ROOM_ID);

    if (elStorageId) elStorageId.textContent = currentUserId || "未定義";
    if (elStorageName) elStorageName.textContent = storedName || "未定義";
    if (elRoomId) elRoomId.textContent = roomId;

    if (currentUserId) {
        console.log(`[DEBUG-AUTH] ローカルストレージにユーザーIDを確認: ${currentUserId}`);
        const { data, error } = await supabase.from('participants')
            .select('state')
            .eq('room_id', roomId)
            .eq('user_id', currentUserId)
            .maybeSingle();
        
        if (error) {
            console.error("[DEBUG-AUTH] 既存ユーザー取得エラー:", error);
            return null;
        }

        if (data) {
            console.log("[DEBUG-AUTH] データベースにユーザーデータが存在する。セッションを復元する。", data.state);
            return currentUserId;
        } else {
            console.warn("[DEBUG-AUTH] データベースにユーザーが存在しないため、ローカルストレージのIDを無効と判定する。");
        }
    }
    return null;
}

/**
 * 新規ログイン（入室）処理を実行する
 */
export async function loginUser(supabase, username) {
    console.log(`[DEBUG-AUTH] loginUser 実行: username=${username}`);
    
    const { data: roomCheck, error: roomError } = await supabase.from('rooms')
        .select('game_state')
        .eq('id', roomId)
        .maybeSingle();
        
    if (roomError) {
        console.error("[DEBUG-AUTH] 部屋状態の取得エラー:", roomError);
        alert(`部屋情報の取得に失敗した: ${roomError.message}`);
        return null;
    }

    if (roomCheck?.game_state?.status && roomCheck.game_state.status !== 'waiting') {
        console.warn(`[DEBUG-AUTH] 入室拒否: 部屋のステータスが ${roomCheck.game_state.status} である。`);
        alert('ゲームが既に開始されているか終了しているため、入室できない。');
        return null;
    }

    const currentUserId = localStorage.getItem('user_id') || 'user_' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem('user_id', currentUserId);
    localStorage.setItem('player_name', username);
    
    // common_utils.js から取得した、最新の整数値フラグスキーマに準拠した初期状態
    const initialRegistrationState = getInitialRegistrationState(username);
    
    console.log("[DEBUG-AUTH] データベースへ送信する初期ステータス:", JSON.stringify(initialRegistrationState, null, 2));
    
    const { error } = await supabase.from('participants').insert(
        [{ room_id: roomId, user_id: currentUserId, state: initialRegistrationState }]
    );
    
    if (error) {
        console.error("[DEBUG-AUTH] ユーザー登録(INSERT)エラー:", error);
        alert(`送信に失敗した: ${error.message}`);
        return null;
    }
    
    console.log(`[DEBUG-AUTH] ログイン(INSERT)完了: user_id=${currentUserId}`);
    return currentUserId;
}

console.log("【デバッグ】index_auth.js が読み込まれました。");
