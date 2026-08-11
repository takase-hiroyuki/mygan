// index_auth.js
import { roomId, SUPABASE_URL, SUPABASE_KEY } from './common_config.js';
import { waitForSupabase,
        getInitialRegistrationState,
        insertSystemMessage,
        writeLog } from './common_utils.js'; // ★ writeLog を追加インポート

// Supabaseクライアントの初期化
export async function initSupabaseClient() {
    const supabaseGlobal = await waitForSupabase();
    return supabaseGlobal.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// 既存のログインセッションが存在するか確認する
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

// 新規ログイン（入室）処理を実行する
export async function loginUser(supabase, username) {
    writeLog(supabase, "System", "Auth", `loginUser を実行します: username=${username}`);
    
    const { data: roomCheck, error: roomError } = await supabase
        .from('rooms')
        .select('game_state')
        .eq('id', roomId)
        .maybeSingle();
        
    if (roomError) {
        writeLog(supabase, "System", "Auth Error", `部屋状態の取得に失敗しました: ${JSON.stringify(roomError)}`);
        await insertSystemMessage(supabase, username, "部屋情報の取得に失敗しました。");
        return null;
    }

    if (!roomCheck) {
        await insertSystemMessage(supabase, username, "指定された部屋が存在しません。");
        return null;
    }

    if (roomCheck.game_state?.status !== 'waiting') {
        writeLog(supabase, "System", "Auth Warning", `入室拒否: 部屋のステータスが '${roomCheck.game_state.status}' です。`);
        await insertSystemMessage(supabase, username, "ゲームが既に開始されているか終了しているため、入室できません。");
        return null;
    }

    // 新規ユーザーIDの生成と保存
    const newUserId = 'user_' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem('user_id', newUserId);
    localStorage.setItem('player_name', username);
    
    // スキーマ準拠の初期状態を取得
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
        await insertSystemMessage(supabase, username, "参加登録に失敗しました。");
        localStorage.removeItem('user_id');
        localStorage.removeItem('player_name');
        return null;
    }
        
    const logBody = `${username} が入室しました。ホストがゲームを開始するまでお待ちください。`;
    await insertSystemMessage(supabase, username, logBody);
    writeLog(supabase, "System", "Auth", "入室ログの書き込みリクエストを送信しました。");
        
    writeLog(supabase, "System", "Auth", `ログイン(INSERT)完了: user_id=${newUserId}`);
    return newUserId;
}

console.log("【残す】index_auth.js が読み込まれました。");
