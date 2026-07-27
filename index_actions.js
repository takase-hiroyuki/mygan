// index_actions.js
import { roomId } from './common_config.js';
import { disableAllActionButtons } from './index_ui.js';

/**
 * サイコロを振るアクション
 * クライアントでの計算を排除し、ロジックを完全にデータベース層へ委譲する
 */
export async function actionRollDice(supabase, currentUserId) {
    if (!supabase || !currentUserId) return;
    
    // イベント発火として、対象のRPCを呼び出すだけ
    const { error } = await supabase.rpc('roll_dice_and_move', { 
        p_room_id: roomId, 
        p_user_id: currentUserId 
    });
    
    if (error) {
        console.error("サイコロ処理エラー:", error);
        alert(`処理エラー: ${error.message}`);
    }
}

/**
 * 手番終了アクション
 */
export async function actionEndTurn(supabase, currentUserId) {
    if (!supabase || !currentUserId) return;

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
