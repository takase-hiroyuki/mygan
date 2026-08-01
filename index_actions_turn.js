// index_actions_turn.js
import { roomId } from './common_config.js';
import { DOM_SELECTORS } from './common_dom_selectors.js';
import { disableAllActionButtons } from './index_ui.js';
import { callRpcWithDebug, OPPORTUNITY_CELLS, DOODAD_CELLS, MARKET_CELLS } from './common_utils.js'; 
import { displaySystemMessage } from './index_state.js'; 

function getLocalPlayerName() {
    const nameEl = document.getElementById(DOM_SELECTORS.GUEST.STATUS.NAME);
    return (nameEl && nameEl.textContent !== '未定') ? nameEl.textContent : 'プレイヤー';
}

async function updatePlayerFlag(supabase, userId, flagName, value) {
    console.log(`[DEBUG_ACTION] updatePlayerFlag: flag=${flagName}, value=${value}`);
    const { data, error: fetchError } = await supabase
        .from('participants')
        .select('state')
        .eq('user_id', userId)
        .single();
        
    if (fetchError || !data) {
        console.error("[CRITICAL_ERROR] フラグ更新時のデータ取得エラー:", fetchError);
        return;
    }

    const newState = { ...data.state };
    newState.flags = newState.flags || {};
    newState.flags[flagName] = value;

    const { error: updateError } = await supabase
        .from('participants')
        .update({ state: newState })
        .eq('user_id', userId);
        
    if (updateError) {
        console.error("[CRITICAL_ERROR] フラグ直接更新に失敗:", updateError);
    }
}

async function getCurrentPlayerState(supabase, userId) {
    const { data, error } = await supabase
        .from('participants')
        .select('state')
        .eq('user_id', userId)
        .single();
    
    if (error || !data) {
        console.error("[CRITICAL_ERROR] プレイヤー状態の取得に失敗:", error);
        return null;
    }
    return data.state || {};
}

export async function actionRollDice(supabase, currentUserId, diceCount = 1) {
    if (!supabase || !currentUserId) return;
    
    console.log(`[DEBUG-ACTION] actionRollDice 開始: ユーザーID=${currentUserId}, サイコロ数=${diceCount}`);

    const state = await getCurrentPlayerState(supabase, currentUserId);
    if (!state) {
        console.error("[CRITICAL_ERROR] プレイヤー状態が取得できません。");
        return;
    }
    
    const playerName = state.name || getLocalPlayerName();
    const flags = state.flags || {};
    const downsizedTurnsLeft = parseInt(flags.downsized_turns_left || 0, 10);
    
    if (flags.has_rolled_dice || flags.is_calculating || downsizedTurnsLeft > 0) {
        console.warn(`[ガード] ロール不可: has_rolled_dice=${flags.has_rolled_dice}, is_calculating=${flags.is_calculating}, downsized_turns_left=${downsizedTurnsLeft}`);
        if (downsizedTurnsLeft > 0) {
            displaySystemMessage(playerName, "エラー", "アクション拒否: リストラ（解雇）による休み期間中です。サイコロは振れず、そのまま手番を終了する必要があります。");
        }
        return;
    }

    try {
        console.log("[DEBUG-ACTION] roll_dice_and_move_v2 実行前");
        await callRpcWithDebug(supabase, 'roll_dice_and_move_v2', { 
            p_room_id: roomId, 
            p_user_id: currentUserId,
            p_dice_count: diceCount
        });
        console.log("[DEBUG-ACTION] roll_dice_and_move_v2 実行完了");
    } catch (error) {
        displaySystemMessage(playerName, "エラー", `処理エラー: ${error.message}`);
        return;
    }

    const newState = await getCurrentPlayerState(supabase, currentUserId);
    if (newState) {
        console.log(`[DEBUG-ACTION] サイコロ移動後の現在地: position=${newState.position}`);
        
        if (newState.position === 9) {
            console.log("[DEBUG-ACTION] 子供マスに停止。action_land_on_baby_v2 を呼び出します。");
            try {
                const babyData = await callRpcWithDebug(supabase, 'action_land_on_baby_v2', {
                    p_room_id: roomId,
                    p_user_id: currentUserId
                });
                
                if (babyData && babyData.message) {
                    displaySystemMessage(playerName, "出産", babyData.message);
                }
            } catch (babyError) {
                displaySystemMessage(playerName, "エラー", `子供マス処理エラー: ${babyError.message}`);
            }
        } else if (newState.position === 20) {
            console.log("[DEBUG-ACTION] 解雇マスに停止。action_land_on_downsized_v2 を呼び出します。");
            try {
                const downsizedData = await callRpcWithDebug(supabase, 'action_land_on_downsized_v2', {
                    p_room_id: roomId,
                    p_user_id: currentUserId
                });
                
                if (downsizedData && downsizedData.message) {
                    displaySystemMessage(playerName, "リストラ", downsizedData.message);
                }
            } catch (error) {
                displaySystemMessage(playerName, "エラー", `解雇マス処理エラー: ${error.message}`);
            }
        } else if (newState.position === 3 || newState.position === 16) {
            console.log("[DEBUG-ACTION] 寄付マスに停止。");
            const totalIncome = parseInt(newState.financials?.total_income || 0, 10);
            const donationAmount = Math.floor(totalIncome / 10);
            
            displaySystemMessage(playerName, "寄付手続き", `総収入の10%（$${donationAmount}）の寄付手続きを開始します。`);
            try {
                console.log("[DEBUG-ACTION] action_donate_charity_v2 実行前");
                const charityData = await callRpcWithDebug(supabase, 'action_donate_charity_v2', {
                    p_room_id: roomId,
                    p_user_id: currentUserId
                });
                
                if (charityData && charityData.message) {
                    displaySystemMessage(playerName, "寄付完了", charityData.message);
                }
            } catch (error) {
                console.error("[CRITICAL-ERROR] 寄付処理に失敗:", error);
                displaySystemMessage(playerName, "エラー", `寄付処理エラー: ${error.message}`);
            }
        } else if (DOODAD_CELLS.includes(newState.position)) {
            console.log("[DEBUG-ACTION] Doodadマスに停止。カード情報を取得します。");
            try {
                const doodadData = await callRpcWithDebug(supabase, 'action_draw_doodad_v2', {
                    p_room_id: roomId,
                    p_user_id: currentUserId
                });
                
                if (doodadData) {
                    if (doodadData.status === 'error') {
                        displaySystemMessage(playerName, "エラー", doodadData.message);
                    } else {
                        const cardText = doodadData.description || doodadData.title || "内容不明";
                        const cardCost = doodadData.cost || 0;
                        
                        displaySystemMessage(playerName, "カードドロー", `Doodadカード「${doodadData.title}」を引きました。 - ${cardText} (費用: $${cardCost})`);
                        
                        const statusMessage = document.getElementById(DOM_SELECTORS.GUEST.CARD.STATUS_MESSAGE);
                        if (statusMessage) {
                            statusMessage.textContent = `【${playerName} が引いたカード】 Doodad: ${doodadData.title} - ${cardText} (費用: $${cardCost})`;
                        }

                        const btnEndTurn = document.getElementById(DOM_SELECTORS.GUEST.CONTROLS.BTN_END_TURN);
                        if (btnEndTurn) {
                            btnEndTurn.disabled = true;
                            btnEndTurn.innerText = 'X ' + btnEndTurn.innerText.replace(/^[OX]\s/, '');
                        }
                    }
                }
            } catch (error) {
                console.error("[CRITICAL-ERROR] Doodad処理エラー:", error);
                displaySystemMessage(playerName, "エラー", `Doodadカード取得エラー: ${error.message}`);
            }
        }
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
    const flags = state.flags || {};
    const position = state.position || 0;
    const financials = state.financials || {};
    
    const hasRolledDice = !!flags.has_rolled_dice;
    const isCalculating = !!flags.is_calculating;
    const isActionCompleted = !!flags.is_action_completed;
    const isNegativeCashFlow = !!flags.is_negative_cash_flow;
    const downsizedTurnsLeft = parseInt(flags.downsized_turns_left || 0, 10);
    const pendingPaydays = parseInt(flags.pending_paydays || 0, 10);
    const isDownsized = downsizedTurnsLeft > 0;
    const cash = parseInt(financials.cash || 0, 10);

    const isCardCell = OPPORTUNITY_CELLS.includes(position) || DOODAD_CELLS.includes(position) || MARKET_CELLS.includes(position);
    const hasMandatoryPaycheck = (pendingPaydays > 0) && isNegativeCashFlow;

    disableAllActionButtons();

    if (cash < 0) {
        displaySystemMessage(playerName, "システム", "ゲームオーバー: 現金がなくなったので、破産しました。");
        try {
            await callRpcWithDebug(supabase, 'action_bankrupt_and_remove', { 
                p_room_id: roomId, 
                p_user_id: currentUserId 
            });
            
            localStorage.removeItem('cashflow_user_id');
            localStorage.removeItem('cashflow_user_name');
            window.location.reload();
            return;
        } catch (error) {
            displaySystemMessage(playerName, "エラー", `処理エラー: ${error.message}`);
            return;
        }
    }

    if (
        (!hasRolledDice && !isDownsized) || 
        isCalculating || 
        (isCardCell && !isActionCompleted) || 
        hasMandatoryPaycheck
    ) {
        console.warn("【ガード】ターン終了の条件を満たしていません。");
        return;
    }
    
    try {
        await callRpcWithDebug(supabase, 'pass_and_end_turn', { 
            p_room_id: roomId, 
            p_user_id: currentUserId 
        });
    } catch (error) {
        displaySystemMessage(playerName, "エラー", error.message);
    }
}

console.log("[デバッグ] index_actions_turn.js が正常にロードされました。");
