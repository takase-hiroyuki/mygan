// index_auth.js
import { roomId, SUPABASE_URL, SUPABASE_KEY } from './common_config.js';
import { waitForSupabase,
        getInitialRegistrationState,
        sendGameProgressMessage,
        writeLog } from './common_utils.js'; 

export async function initSupabaseClient() {
    const supabaseGlobal = await waitForSupabase();
    return supabaseGlobal.createClient(SUPABASE_URL, SUPABASE_KEY);
}

export async function checkExistingLogin(supabase, guestSelectors) {
    writeLog(supabase, "System", "Auth", "checkExistingLogin を実行します。");
    
    const currentUserId = localStorage.getItem('user_id');
    const storedName = localStorage.getItem('player_name');
    
    const elRoomId = document.getElementById(guestSelectors.STATUS.ROOM_ID);
    if (elRoomId) elRoomId.textContent = roomId;

    if (!currentUserId) {
        writeLog(supabase, "System", "Auth", "ローカルストレージにユーザーIDが存在しません。");
        return null;
    }

    writeLog(supabase, "System", "Auth", `ローカルストレージからユーザーIDを取得: ${currentUserId}`);
    
    const { data, error } = await supabase
        .from('participants')
        .select('state')
        .eq('room_id', roomId)
        .eq('user_id', currentUserId)
        .maybeSingle();
    
    if (error) {
        writeLog(supabase, "System", "Auth Error", `既存ユーザー状態の取得に失敗しました: ${JSON.stringify(error)}`);
        return null;
    }

    if (data) {
        writeLog(supabase, "System", "Auth", "データベースにユーザーデータが存在します。セッションを復元します。");
        return currentUserId;
    }

    writeLog(supabase, "System", "Auth Warning", "データベースにユーザーが存在しません。ローカルストレージのIDを破棄します。");
    localStorage.removeItem('user_id');
    localStorage.removeItem('player_name');
    return null;
}

export async function loginUser(supabase, username) {
    writeLog(supabase, "System", "Auth", `loginUser を実行します: username=${username}`);
    
    const { data: roomCheck, error: roomError } = await supabase
        .from('rooms')
        .select('game_state')
        .eq('id', roomId)
        .maybeSingle();
        
    if (roomError) {
        writeLog(supabase, "System", "Auth Error", `部屋状態の取得に失敗しました: ${JSON.stringify(roomError)}`);
        sendGameProgressMessage(supabase, roomId, username, "部屋情報の取得に失敗しました。", "loginUser");
        return null;
    }

    if (!roomCheck) {
        sendGameProgressMessage(supabase, roomId, username, "指定された部屋が存在しません。", "loginUser");
        return null;
    }

    if (roomCheck.game_state?.status !== 'waiting') {
        writeLog(supabase, "System", "Auth Warning", `入室拒否: 部屋のステータスが '${roomCheck.game_state.status}' です。`);
        sendGameProgressMessage(supabase, roomId, username, "ゲームが既に開始されているか終了しているため、入室できません。", "loginUser");
        return null;
    }

    const newUserId = 'user_' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem('user_id', newUserId);
    localStorage.setItem('player_name', username);
    
    const initialRegistrationState = getInitialRegistrationState(username);
    writeLog(supabase, "System", "Auth", `データベースへ送信する初期ステータス: ${JSON.stringify(initialRegistrationState, null, 2)}`);
    
    const { error: insertError } = await supabase
        .from('participants')
        .insert([{ 
            room_id: roomId, 
            user_id: newUserId, 
            state: initialRegistrationState 
        }]);
    
    if (insertError) {
        writeLog(supabase, "System", "Auth Error", `ユーザー登録(INSERT)に失敗しました: ${JSON.stringify(insertError)}`);
        sendGameProgressMessage(supabase, roomId, username, "参加登録に失敗しました。", "loginUser");
        localStorage.removeItem('user_id');
        localStorage.removeItem('player_name');
        return null;
    }
        
    const logBody = `${username} が入室しました。ホストがゲームを開始するまでお待ちください。`;
    sendGameProgressMessage(supabase, roomId, username, logBody, "loginUser");
    writeLog(supabase, "System", "Auth", "入室ログの書き込みリクエストを送信しました。");
        
    writeLog(supabase, "System", "Auth", `ログイン(INSERT)完了: user_id=${newUserId}`);
    return newUserId;
}

console.log("【残す】index_auth.js が読み込まれました。");
