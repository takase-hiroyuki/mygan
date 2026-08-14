// index_actions_turn.js
import { roomId } from './common_config.js';
import { callRpcWithDebug,
         CELLS_OPPORTUNITY,
         CELLS_DOODAD,
         CELLS_MARKET,
         BOARD_CELL_NAMES,
         getLocalPlayerName,
         writeLog } from './common_utils.js';

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
    if (!supabase || !currentUserId) return false;
    
    try {
        await callRpcWithDebug(supabase, 'draw_card_v2', {
            p_room_id: roomId,
            p_user_id: currentUserId,
            p_deck_type: deckType
        });
        return true;
    } catch (error) {
        const playerName = getLocalPlayerName();
        writeLog(supabase, playerName, "Error", `カード取得エラー: ${error.message}`);
        return false;
    }
}

export async function actionRollDice(supabase, currentUserId, diceCount = 1) {
    if (!supabase || !currentUserId) return { error: "無効なリクエスト" };

    const state = await getCurrentPlayerState(supabase, currentUserId);
    if (!state) return { error: "状態が取得できません" };
    
    const playerName = state.name || getLocalPlayerName();
    const flags = state.flags || {};
    const downsizedTurnsLeft = parseInt(flags.downsized_turns_left || 0, 10);
    
    if (flags.has_rolled_dice || flags.is_calculating || downsizedTurnsLeft > 0) {
        if (downsizedTurnsLeft > 0) {
            return { error: "休み期間中。そのまま手番を終了して下さい。" };
        }
        return { error: "現在サイコロを振ることはできません。" };
    }

    try {
        await callRpcWithDebug(supabase, 'roll_dice_and_move_v2', { 
            p_room_id: roomId, 
            p_user_id: currentUserId,
            p_dice_count: diceCount
        });
        
        const postMoveState = await getCurrentPlayerState(supabase, currentUserId);
        if (postMoveState && postMoveState.position !== undefined) {
            const newPos = parseInt(postMoveState.position, 10);
            const diceVal = postMoveState.last_dice;
            const posStr = String(newPos).padStart(2, '0');
            const cellName = BOARD_CELL_NAMES[newPos] || "";
            
            const isOpportunity = CELLS_OPPORTUNITY.includes(newPos);
            const isMarket = CELLS_MARKET.includes(newPos);
            const isDoodad = CELLS_DOODAD.includes(newPos);

            setTimeout(async () => {
                if (isMarket) {
                    await actionDrawCard(supabase, currentUserId, 'market');
                } else if (isDoodad) {
                    await actionDrawCard(supabase, currentUserId, 'doodad');
                }
            }, 500);

            return { success: true, diceVal, posStr, cellName, isOpportunity };
        }
        return { error: "移動後の状態が取得できませんでした。" };
    } catch (error) {
        writeLog(supabase, playerName, "Error", `エラー: ${error.message}`);
        return { error: error.message };
    }
}

export async function actionProcessSelf(supabase, currentUserId, qty = 1) {
    if (!supabase || !currentUserId) return { error: "無効なリクエスト" };

    const state = await getCurrentPlayerState(supabase, currentUserId);
    if (!state) return { error: "状態が取得できません" };

    const playerName = state.name || getLocalPlayerName();
    const isCharity = [3, 16].includes(parseInt(state.position, 10));

    try {
        if (isCharity && !state.drawn_card && !state.flags.is_action_completed) {
            await callRpcWithDebug(supabase, 'donate_charity_v2', {
                p_room_id: roomId,
                p_user_id: currentUserId
            });
            return { success: true, type: 'charity' };
        }

        const cardTitle = state.drawn_card ? state.drawn_card.title : "カード";

        if (state.drawn_card && state.drawn_card.asset_type === 'other') {
            await callRpcWithDebug(supabase, 'execute_special_event_v2', {
                p_room_id: roomId,
                p_user_id: currentUserId
            });
            return { success: true, type: 'other', cardTitle };
        } else {
            await callRpcWithDebug(supabase, 'execute_drawn_card_v2', {
                p_room_id: roomId,
                p_user_id: currentUserId,
                p_input_quantity: qty
            });
            return { success: true, type: 'normal', cardTitle, qty };
        }
    } catch (error) {
        writeLog(supabase, playerName, "Error", `エラー: ${error.message}`);
        return { error: error.message };
    }
}

export async function actionPass(supabase, currentUserId) {
    if (!supabase || !currentUserId) return false;
    
    const playerName = getLocalPlayerName();
    try {
        await callRpcWithDebug(supabase, 'complete_action_v2', {
            p_room_id: roomId,
            p_user_id: currentUserId
        });
        return true;
    } catch (error) {
        writeLog(supabase, playerName, "Error", `エラー: ${error.message}`);
        return false;
    }
}

export async function actionEndTurn(supabase, currentUserId) {
    if (!supabase || !currentUserId) return false;

    const state = await getCurrentPlayerState(supabase, currentUserId);
    if (!state) return false;
    
    const playerName = state.name || getLocalPlayerName();
    const financials = state.financials || {};
    const cash = parseInt(financials.cash || 0, 10);

    if (cash < 0) {
        try {
            await callRpcWithDebug(supabase, 'action_bankrupt_and_remove_v2', { 
                p_room_id: roomId, 
                p_user_id: currentUserId 
            });
            
            localStorage.removeItem('cashflow_user_id');
            localStorage.removeItem('cashflow_user_name');
            window.location.reload();
            return true;
        } catch (error) {
            writeLog(supabase, playerName, "Error", `エラー: ${error.message}`);
            return false;
        }
    }

    try {
        await callRpcWithDebug(supabase, 'pass_and_end_turn_v2', { 
            p_room_id: roomId, 
            p_user_id: currentUserId 
        });
        return true;
    } catch (error) {
        writeLog(supabase, playerName, "Error", `エラー: ${error.message}`);
        return false;
    }
}

console.log("【残す】 index_actions_turn.js が正常にロードされました。");
