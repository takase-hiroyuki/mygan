// index_actions_turn.js
import { roomId } from './common_config.js';
import { SEL_G } from './common_dom_selectors.js'; 
import { disableAllActionButtons } from './index_ui_base.js';
import { callRpcWithDebug,
         CELLS_OPPORTUNITY,
         CELLS_DOODAD,
         CELLS_MARKET,
         insertSystemMessage,
         getLocalPlayerName } from './common_utils.js';

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

export async function actionDrawCard(supabase, currentUserId, deckType) {
    if (!supabase || !currentUserId) return;
    
    const btnSmall = document.getElementById(SEL_G.CARD.BTN_SMALL_DEAL);
    const btnBig = document.getElementById(SEL_G.CARD.BTN_BIG_DEAL);
    if (btnSmall) btnSmall.disabled = true;
    if (btnBig) btnBig.disabled = true;

    try {
        await callRpcWithDebug(supabase, 'draw_card_v2', {
            p_room_id: roomId,
            p_user_id: currentUserId,
            p_deck_type: deckType
        });
    } catch (error) {
        const playerName = getLocalPlayerName();
        await insertSystemMessage(supabase, playerName, `カード取得エラー: ${error.message}`);
        if (btnSmall) btnSmall.disabled = false;
        if (btnBig) btnBig.disabled = false;
    }
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
        const moveResult = await callRpcWithDebug(supabase, 'roll_dice_and_move_v2', { 
            p_room_id: roomId, 
            p_user_id: currentUserId,
            p_dice_count: diceCount
        });
        
        const postMoveState = await getCurrentPlayerState(supabase, currentUserId);
        if (postMoveState && postMoveState.position !== undefined) {
            const newPos = parseInt(postMoveState.position, 10);
            
            setTimeout(async () => {
                if (CELLS_MARKET.includes(newPos)) {
                    await actionDrawCard(supabase, currentUserId, 'market');
                } else if (CELLS_DOODAD.includes(newPos)) {
                    await actionDrawCard(supabase, currentUserId, 'doodad');
                }
            }, 500);
        }
        
    } catch (error) {
        await insertSystemMessage(supabase, playerName, `エラー: ${error.message}`);
    }
}

export async function actionProcessSelf(supabase, currentUserId, qty = 1) {
    if (!supabase || !currentUserId) return;

    const state = await getCurrentPlayerState(supabase, currentUserId);
    if (!state) return;

    const playerName = state.name || getLocalPlayerName();
    const isCharity = [3, 16].includes(parseInt(state.position, 10));

    try {
        if (isCharity && !state.drawn_card && !state.flags.is_action_completed) {
            await callRpcWithDebug(supabase, 'donate_charity_v2', {
                p_room_id: roomId,
                p_user_id: currentUserId
            });
            await insertSystemMessage(supabase, playerName, "寄付を行いました。以降のターンでサイコロを2個振る権利を獲得しました。");
            return;
        }

        if (state.drawn_card && state.drawn_card.asset_type === 'other') {
            await callRpcWithDebug(supabase, 'execute_special_event_v2', {
                p_room_id: roomId,
                p_user_id: currentUserId
            });
        } else {
            await callRpcWithDebug(supabase, 'execute_drawn_card_v2', {
                p_room_id: roomId,
                p_user_id: currentUserId,
                p_input_quantity: qty
            });
        }
    } catch (error) {
        await insertSystemMessage(supabase, playerName, `エラー: ${error.message}`);
    }
}

export async function actionPass(supabase, currentUserId) {
    if (!supabase || !currentUserId) return;
    
    const playerName = getLocalPlayerName();
    try {
        await callRpcWithDebug(supabase, 'complete_action_v2', {
            p_room_id: roomId,
            p_user_id: currentUserId
        });
    } catch (error) {
        await insertSystemMessage(supabase, playerName, `エラー: ${error.message}`);
    }
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

    try {
        await callRpcWithDebug(supabase, 'pass_and_end_turn_v2', { 
            p_room_id: roomId, 
            p_user_id: currentUserId 
        });
    } catch (error) {
        await insertSystemMessage(supabase, playerName, `エラー: ${error.message}`);
    }
}
