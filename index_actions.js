// index_actions.js
import { roomId } from './common_config.js';
import { DOM_SELECTORS } from './common_dom_selectors.js';
import { disableAllActionButtons } from './index_ui.js';

/**
 * プレイヤーの状態(state)内のflagsの一部を直接更新するヘルパー関数
 * （※将来的にRPCへ移行するまでの暫定的なJS-directアプローチ）
 * （※既にRPC化されたアクションからは、データ競合を避けるため呼び出しません）
 */
async function updatePlayerFlag(supabase, userId, flagName, value) {
    const { data, error: fetchError } = await supabase
        .from('participants')
        .select('state')
        .eq('user_id', userId)
        .single();
        
    if (fetchError || !data) {
        console.error("フラグ更新時のデータ取得エラー:", fetchError);
        return;
    }

    const newState = { ...data.state };
    newState.flags = newState.flags || {};
    newState.flags[flagName] = value;

    await supabase
        .from('participants')
        .update({ state: newState })
        .eq('user_id', userId);
}

/**
 * 現在のプレイヤー状態をDBから取得するヘルパー関数（ガード処理用）
 */
async function getCurrentPlayerState(supabase, userId) {
    const { data, error } = await supabase
        .from('participants')
        .select('state')
        .eq('user_id', userId)
        .single();
    
    if (error || !data) return null;
    return data.state || {};
}

/**
 * サイコロを振るアクション
 */
export async function actionRollDice(supabase, currentUserId) {
    if (!supabase || !currentUserId) return;
    
    // アクション実行前のガード処理（フラグ検証）
    const state = await getCurrentPlayerState(supabase, currentUserId);
    if (!state) return;
    const flags = state.flags || {};
    if (flags.has_rolled_dice || flags.is_calculating) {
        console.warn("【ガード】既にサイコロを振ったか、計算中のためサイコロを振れません。");
        return;
    }

    // ★追加: サイコロを振る前の状態をログ出力
    console.log(`[DEBUG-ACTION] サイコロ実行前 - 現在位置: ${state.position}`);

    // RPC呼び出し（フラグの更新はRPC内で行われます）
    const { error } = await supabase.rpc('roll_dice_and_move', { 
        p_room_id: roomId, 
        p_user_id: currentUserId 
    });
    
    if (error) {
        console.error("サイコロ処理エラー:", error);
        alert(`処理エラー: ${error.message}`);
        return; // エラーが発生した場合はここで中断
    }

    // ★追加: サイコロ実行後の最新状態を取得して評価するデバッグ
    const newState = await getCurrentPlayerState(supabase, currentUserId);
    if (newState) {
        console.log(`[DEBUG-ACTION] サイコロ実行後 - 新しい位置: ${newState.position}`);
        
        // 09番マス (子供) に止まったかどうかの判定テスト
        if (newState.position === 9) {
            console.log("[DEBUG-ACTION] ★09番マス (子供) への停止を検知しました！ (ここで action_land_on_baby を呼ぶ予定です)");
        }
    }
}

/**
 * 給料手動請求アクション（Paycheck請求）
 */
export async function actionClaimPaycheck(supabase, currentUserId) {
    if (!supabase || !currentUserId) return;
    
    // 連打防止のため即座にボタンを無効化
    const claimButton = document.getElementById(DOM_SELECTORS.GUEST.CONTROLS.BTN_CLAIM_PAYCHECK);
    if (claimButton) claimButton.disabled = true;

    // RPC呼び出し（フラグの更新はRPC内で行われます）
    const { error } = await supabase.rpc('claim_paycheck', { 
        p_room_id: roomId, 
        p_user_id: currentUserId 
    });
    
    if (error) {
        console.error("Paycheck請求エラー:", error);
        alert(`処理エラー: ${error.message}`);
        // エラー時はボタンを復旧
        if (claimButton) claimButton.disabled = false;
    }
}

/**
 * パス（見送る）アクション
 * （※この処理はまだRPC化されていないため、暫定的にJS側でのフラグ更新を残します）
 */
export async function actionPass(supabase, currentUserId) {
    if (!supabase || !currentUserId) return;
    await updatePlayerFlag(supabase, currentUserId, 'is_action_completed', true);
}

/**
 * 手番終了アクション
 */
export async function actionEndTurn(supabase, currentUserId) {
    if (!supabase || !currentUserId) return;

    // アクション実行前のガード処理（フラグ検証）
    const state = await getCurrentPlayerState(supabase, currentUserId);
    if (!state) return;
    const flags = state.flags || {};
    
    if (!flags.has_rolled_dice || flags.is_calculating || flags.is_negative_cash_flow) {
        console.warn("【ガード】ターン終了の条件を満たしていません（未ロール、計算中、またはマイナスキャッシュフロー）。");
        return;
    }

    disableAllActionButtons();
    
    // RPC呼び出し（次ターンの判定と、フラグの全リセットはRPC内で行われます）
    const { error } = await supabase.rpc('pass_and_end_turn', { 
        p_room_id: roomId, 
        p_user_id: currentUserId 
    });

    if (error) {
        console.error("手番終了エラー:", error);
        alert(`エラー: ${error.message}`);
    }
}

console.log("【デバッグ】index_actions.js が読み込まれました。");
