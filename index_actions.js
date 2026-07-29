// index_actions.js
import { roomId } from './common_config.js';
import { DOM_SELECTORS } from './common_dom_selectors.js';
import { disableAllActionButtons } from './index_ui.js';

/**
 * プレイヤーの状態(state)内のflagsの一部を直接更新するヘルパー関数
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
 * 現在のプレイヤー状態をDBから取得するヘルパー関数
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
    
    const state = await getCurrentPlayerState(supabase, currentUserId);
    if (!state) return;
    const flags = state.flags || {};
    if (flags.has_rolled_dice || flags.is_calculating) {
        console.warn("【ガード】既にサイコロを振ったか、計算中のためサイコロを振れません。");
        return;
    }

    // 1. サイコロを振るRPCを実行
    const { error } = await supabase.rpc('roll_dice_and_move', { 
        p_room_id: roomId, 
        p_user_id: currentUserId 
    });
    
    if (error) {
        console.error("サイコロ処理エラー:", error);
        alert(`処理エラー: ${error.message}`);
        return;
    }

    // 2. 移動後の位置を取得
    const newState = await getCurrentPlayerState(supabase, currentUserId);
    if (newState) {
        // ★修正: 09番マス (子供) に止まった場合のRPC呼び出し処理を追加
        if (newState.position === 9) {
            console.log("[DEBUG-ACTION] 子供マスに停止。action_land_on_baby を呼び出します。");
            const { data: babyData, error: babyError } = await supabase.rpc('action_land_on_baby', {
                p_room_id: roomId,
                p_user_id: currentUserId
            });
            
            if (babyError) {
                console.error("子供マス処理エラー:", babyError);
                alert(`子供マス処理エラー: ${babyError.message}`);
            } else {
                console.log("[DEBUG-ACTION] 子供マス処理成功:", babyData);
                // 成功時のアラート表示（任意）
                if (babyData && babyData.message) {
                    alert(babyData.message);
                }
            }
        }
    }
}

/**
 * 給料手動請求アクション（Paycheck請求）
 */
export async function actionClaimPaycheck(supabase, currentUserId) {
    if (!supabase || !currentUserId) return;
    
    const claimButton = document.getElementById(DOM_SELECTORS.GUEST.CONTROLS.BTN_CLAIM_PAYCHECK);
    if (claimButton) claimButton.disabled = true;

    const { error } = await supabase.rpc('claim_paycheck', { 
        p_room_id: roomId, 
        p_user_id: currentUserId 
    });
    
    if (error) {
        console.error("Paycheck請求エラー:", error);
        alert(`処理エラー: ${error.message}`);
        if (claimButton) claimButton.disabled = false;
    }
}

/**
 * パス（見送る）アクション
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

    const state = await getCurrentPlayerState(supabase, currentUserId);
    if (!state) return;
    const flags = state.flags || {};
    
    if (!flags.has_rolled_dice || flags.is_calculating || flags.is_negative_cash_flow) {
        console.warn("【ガード】ターン終了の条件を満たしていません（未ロール、計算中、またはマイナスキャッシュフロー）。");
        return;
    }

    disableAllActionButtons();
    
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
