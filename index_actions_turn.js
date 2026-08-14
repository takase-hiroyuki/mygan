// index_actions_turn.js
import { roomId } from './common_config.js';
import { callRpcWithDebug,
         CELLS_OPPORTUNITY,
         CELLS_DOODAD,
         CELLS_MARKET,
         BOARD_CELL_NAMES,
         getLocalPlayerName,
         writeLog,
         sendGameProgressMessage } from './common_utils.js';

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
    const playerName = getLocalPlayerName();
    
    try {
        await callRpcWithDebug(supabase, 'draw_card_v2', {
            p_room_id: roomId,
            p_user_id: currentUserId,
            p_deck_type: deckType
        });
        
        const deckName = deckType === 'small_deal' ? '普通の商売' : deckType === 'big_deal' ? '大きな商売' : deckType === 'market' ? '市場' : '娯楽';
        sendGameProgressMessage(supabase, roomId, playerName, `${playerName} は、${deckName} のカードをひきました`, "actionDrawCard");
        return true;
    } catch (error) {
        writeLog(supabase, playerName, "Error", `カード取得エラー: ${error.message}`);
        sendGameProgressMessage(supabase, roomId, playerName, error.message, "actionDrawCard");
        return false;
    }
}

export async function actionRollDice(supabase, currentUserId, diceCount = 1) {
    if (!supabase || !currentUserId) return { error: "無効なリクエスト" };

    const state = await getCurrentPlayerState(supabase, currentUserId);
    const playerName = state?.name || getLocalPlayerName();
    if (!state) {
        sendGameProgressMessage(supabase, roomId, playerName, "状態が取得できません", "actionRollDice");
        return { error: "状態が取得できません" };
    }
    
    const flags = state.flags || {};
    const downsizedTurnsLeft = parseInt(flags.downsized_turns_left || 0, 10);
    
    if (flags.has_rolled_dice || flags.is_calculating || downsizedTurnsLeft > 0) {
        const errStr = downsizedTurnsLeft > 0 ? "休み中⇒「次の人へ」" : "現在サイコロを振ることはできません。";
        sendGameProgressMessage(supabase, roomId, playerName, errStr, "actionRollDice");
        return { error: errStr };
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

            let msg = `${diceVal}の目が出て、${posStr}${cellName} に移動しました。`;
            if (isOpportunity) {
                msg += `${playerName} は「普通の商売」「大きな商売」をひいてください`;
            } else if (isDoodad) {
                msg += `カードをただちに処理して下さい。`;
            }
            sendGameProgressMessage(supabase, roomId, playerName, msg, "actionRollDice");

            return { success: true, diceVal, posStr, cellName, isOpportunity };
        }
        sendGameProgressMessage(supabase, roomId, playerName, "移動後の状態が取得できませんでした。", "actionRollDice");
        return { error: "移動後の状態が取得できませんでした。" };
    } catch (error) {
        writeLog(supabase, playerName, "Error", `エラー: ${error.message}`);
        sendGameProgressMessage(supabase, roomId, playerName, error.message, "actionRollDice");
        return { error: error.message };
    }
}

export async function actionProcessSelf(supabase, currentUserId, qty = 1) {
    if (!supabase || !currentUserId) return { error: "無効なリクエスト" };

    const state = await getCurrentPlayerState(supabase, currentUserId);
    const playerName = state?.name || getLocalPlayerName();
    if (!state) {
        sendGameProgressMessage(supabase, roomId, playerName, "状態が取得できません", "actionProcessSelf");
        return { error: "状態が取得できません" };
    }

    const isCharity = [3, 16].includes(parseInt(state.position, 10));

    try {
        if (isCharity && !state.drawn_card && !state.flags.is_action_completed) {
            await callRpcWithDebug(supabase, 'donate_charity_v2', {
                p_room_id: roomId,
                p_user_id: currentUserId
            });
            sendGameProgressMessage(supabase, roomId, playerName, "寄付しました。サイコロを2個振れます。", "actionProcessSelf");
            return { success: true, type: 'charity' };
        }

        const cardTitle = state.drawn_card ? state.drawn_card.title : "カード";

        if (state.drawn_card && state.drawn_card.asset_type === 'other') {
            await callRpcWithDebug(supabase, 'execute_special_event_v2', {
                p_room_id: roomId,
                p_user_id: currentUserId
            });
            sendGameProgressMessage(supabase, roomId, playerName, `「${cardTitle}」を適用しました。`, "actionProcessSelf");
            return { success: true, type: 'other', cardTitle };
        } else {
            await callRpcWithDebug(supabase, 'execute_drawn_card_v2', {
                p_room_id: roomId,
                p_user_id: currentUserId,
                p_input_quantity: qty
            });
            const qtyStr = Number(qty).toLocaleString();
            sendGameProgressMessage(supabase, roomId, playerName, `「${cardTitle}」を ${qtyStr} 個、処理しました。`, "actionProcessSelf");
            return { success: true, type: 'normal', cardTitle, qty };
        }
    } catch (error) {
        writeLog(supabase, playerName, "Error", `エラー: ${error.message}`);
        sendGameProgressMessage(supabase, roomId, playerName, error.message, "actionProcessSelf");
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
        sendGameProgressMessage(supabase, roomId, playerName, `${playerName} は、パスしました。`, "actionPass");
        return true;
    } catch (error) {
        writeLog(supabase, playerName, "Error", `エラー: ${error.message}`);
        sendGameProgressMessage(supabase, roomId, playerName, error.message, "actionPass");
        return false;
    }
}

export async function actionEndTurn(supabase, currentUserId) {
    if (!supabase || !currentUserId) return false;

    const state = await getCurrentPlayerState(supabase, currentUserId);
    const playerName = state?.name || getLocalPlayerName();
    if (!state) return false;
    
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
            sendGameProgressMessage(supabase, roomId, playerName, error.message, "actionEndTurn");
            return false;
        }
    }

    try {
        await callRpcWithDebug(supabase, 'pass_and_end_turn_v2', { 
            p_room_id: roomId, 
            p_user_id: currentUserId 
        });
        // EndTurn成功時は fetchAndRender が手番変更メッセージを出すためここは省略
        return true;
    } catch (error) {
        writeLog(supabase, playerName, "Error", `エラー: ${error.message}`);
        sendGameProgressMessage(supabase, roomId, playerName, error.message, "actionEndTurn");
        return false;
    }
}

console.log("【残す】 index_actions_turn.js が正常にロードされました。");
