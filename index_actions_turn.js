// index_actions_turn.js
import { roomId } from './common_config.js';
import { SEL_G } from './common_dom_selectors.js'; 
import { disableAllActionButtons } from './index_ui.js';
import { callRpcWithDebug,
         CELLS_OPPORTUNITY,
         CELLS_DOODAD,
         CELLS_MARKET,
         insertSystemMessage,
         getLocalPlayerName } from './common_utils.js';

async function updatePlayerFlag(supabase, userId, flagName, value) {
    const { data, error: fetchError } = await supabase
        .from('participants')
        .select('state')
        .eq('user_id', userId)
        .single();
        
    if (fetchError || !data) {
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

async function getCurrentPlayerState(supabase, userId) {
    const { data, error } = await supabase
        .from('participants')
        .select('state')
        .eq('user_id', userId)
        .single();
    
    if (error || !data) {
        return null;
    }
    return data.state || {};
}

export async function actionRollDice(supabase, currentUserId, diceCount = 1) {
    if (!supabase || !currentUserId) return;

    const state = await getCurrentPlayerState(supabase, currentUserId);
    if (!state) return;
    
    const playerName = state.name || getLocalPlayerName();
    const flags = state.flags || {};
    const downsizedTurnsLeft = parseInt(flags.downsized_turns_left || 0, 10);
    
    if (flags.has_rolled_dice || flags.is_calculating || downsizedTurnsLeft > 0) {
        if (downsizedTurnsLeft > 0) {
            await insertSystemMessage(supabase, playerName, "休み期間中。そのまま手番を終了して下さい。");
        }
        return;
    }

    try {
        await callRpcWithDebug(supabase, 'roll_dice_and_move_v2', { 
            p_room_id: roomId, 
            p_user_id: currentUserId,
            p_dice_count: diceCount
        });
    } catch (error) {
        await insertSystemMessage(supabase, playerName, `エラー: ${error.message}`);
    }
}

export async function actionPass(supabase, currentUserId) {
    if (!supabase || !currentUserId) return;
    await updatePlayerFlag(supabase, currentUserId, 'is_action_completed', true);
}

export async function actionEndTurn(supabase, currentUserId) {
    if (!supabase || !currentUserId) return;

    const state = await getCurrentPlayerState(supabase, currentUserId);
    if (!state) return;
    
    const playerName = state.name || getLocalPlayerName();
    const financials = state.financials || {};
    const cash = parseInt(financials.cash || 0, 10);

    disableAllActionButtons();

    if (cash < 0) {
        try {
            await callRpcWithDebug(supabase, 'action_bankrupt_and_remove_v2', { 
                p_room_id: roomId, 
                p_user_id: currentUserId 
            });
            
            localStorage.removeItem('cashflow_user_id');
            localStorage.removeItem('cashflow_user_name');
            window.location.reload();
            return;
        } catch (error) {
            await insertSystemMessage(supabase, playerName, `エラー: ${error.message}`);
            return;
        }
    }

    // ターン終了を阻害するすべての条件分岐（if文）を削除し、無条件で次の人に手番を移行する
    try {
        await callRpcWithDebug(supabase, 'pass_and_end_turn_v2', { 
            p_room_id: roomId, 
            p_user_id: currentUserId 
        });
    } catch (error) {
        await insertSystemMessage(supabase, playerName, `エラー: ${error.message}`);
    }
}

console.log("[デバッグ] index_actions_turn.js が正常にロードされました。");
