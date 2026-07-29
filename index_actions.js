// index_actions.js
import { roomId } from './common_config.js';
import { DOM_SELECTORS } from './common_dom_selectors.js';
import { disableAllActionButtons } from './index_ui.js';
import { callRpcWithDebug } from './common_utils.js'; // ★共通ラッパー関数のインポート

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
 * @param {Object} supabase - Supabaseクライアント
 * @param {string} currentUserId - 現在のユーザーID
 * @param {number} diceCount - 振るサイコロの数（デフォルト 1）
 */
export async function actionRollDice(supabase, currentUserId, diceCount = 1) { // ★修正: 引数にdiceCountを追加
    if (!supabase || !currentUserId) return;
    
    const state = await getCurrentPlayerState(supabase, currentUserId);
    if (!state) return;
    const flags = state.flags || {};
    if (flags.has_rolled_dice || flags.is_calculating) {
        console.warn("【ガード】既にサイコロを振ったか、計算中のためサイコロを振れません。");
        return;
    }

    // 1. サイコロを振るRPCを実行 (★修正: callRpcWithDebugを使用し、diceCountを渡す)
    try {
        await callRpcWithDebug(supabase, 'roll_dice_and_move', { 
            p_room_id: roomId, 
            p_user_id: currentUserId,
            p_dice_count: diceCount
        });
    } catch (error) {
        alert(`処理エラー: ${error.message}`);
        return;
    }

    // 2. 移動後の位置を取得
    const newState = await getCurrentPlayerState(supabase, currentUserId);
    if (newState) {
        // 09番マス (子供) に止まった場合のRPC呼び出し処理を追加
        if (newState.position === 9) {
            console.log("[DEBUG-ACTION] 子供マスに停止。action_land_on_baby を呼び出します。");
            try {
                // ★修正: callRpcWithDebug を使用
                const babyData = await callRpcWithDebug(supabase, 'action_land_on_baby', {
                    p_room_id: roomId,
                    p_user_id: currentUserId
                });
                
                console.log("[DEBUG-ACTION] 子供マス処理成功:", babyData);
                if (babyData && babyData.message) {
                    alert(babyData.message);
                }
            } catch (babyError) {
                alert(`子供マス処理エラー: ${babyError.message}`);
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

    try {
        // ★修正: callRpcWithDebug を使用
        await callRpcWithDebug(supabase, 'claim_paycheck', { 
            p_room_id: roomId, 
            p_user_id: currentUserId 
        });
    } catch (error) {
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
    
    try {
        // ★修正: callRpcWithDebug を使用
        await callRpcWithDebug(supabase, 'pass_and_end_turn', { 
            p_room_id: roomId, 
            p_user_id: currentUserId 
        });
    } catch (error) {
        alert(`エラー: ${error.message}`);
    }
}

/**
 * 手入力した計算結果を検証し、正しければ計算フェーズを解除する
 */
export async function actionCheckCalculations(supabase, currentUserId) {
    if (!supabase || !currentUserId) return;

    const inputIncomeEl = document.getElementById(DOM_SELECTORS.GUEST.FINANCIALS.INPUT_TOTAL_INCOME);
    const inputCashflowEl = document.getElementById(DOM_SELECTORS.GUEST.FINANCIALS.INPUT_NET_CASHFLOW);

    console.log("[DEBUG] Income Element:", inputIncomeEl);
    console.log("[DEBUG] Cashflow Element:", inputCashflowEl);
    if (inputIncomeEl) console.log("[DEBUG] Income Value:", inputIncomeEl.value);
    if (inputCashflowEl) console.log("[DEBUG] Cashflow Value:", inputCashflowEl.value);

    // 空文字の場合はNaNになるように処理
    const rawIncome = inputIncomeEl ? inputIncomeEl.value.replace(/,/g, '').trim() : "";
    const rawCashflow = inputCashflowEl ? inputCashflowEl.value.replace(/,/g, '').trim() : "";

    const userInputIncome = rawIncome === "" ? NaN : parseInt(rawIncome, 10);
    const userInputCashflow = rawCashflow === "" ? NaN : parseInt(rawCashflow, 10);

    if (isNaN(userInputIncome) || isNaN(userInputCashflow)) {
        alert('総収入と毎月のキャッシュフローの双方に数値を正しく入力してください。');
        return;
    }

    try {
        // ★修正: callRpcWithDebug を使用
        const data = await callRpcWithDebug(supabase, 'action_check_calculations', {
            p_room_id: roomId,
            p_user_id: currentUserId,
            p_input_income: userInputIncome,
            p_input_cashflow: userInputCashflow
        });

        // RPCから返却された JSONB の status を判定
        if (data.status === 'error') {
            alert(data.message); // 「計算結果が正しくありません」などを表示
        } else {
            alert(data.message); // 成功メッセージを表示
            
            // 成功後、入力フィールドをクリアする
            if (inputIncomeEl) inputIncomeEl.value = '';
            if (inputCashflowEl) inputCashflowEl.value = '';
        }
    } catch (error) {
        alert('エラーが発生しました: ' + error.message);
    }
}

console.log("【デバッグ】index_actions.js が読み込まれました。");
