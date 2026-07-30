// index_actions.js
import { roomId } from './common_config.js';
import { DOM_SELECTORS } from './common_dom_selectors.js';
import { disableAllActionButtons } from './index_ui.js';
import { callRpcWithDebug } from './common_utils.js'; 

/**
 * プレイヤーの状態(state)内のflagsの一部を直接更新するヘルパー関数
 * 【警告】この関数は将来的に非推奨とし、状態変更はすべてRPCを経由するべきです。
 */
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

/**
 * 現在のプレイヤー状態をDBから取得するヘルパー関数
 */
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

/**
 * サイコロを振るアクション
 * @param {Object} supabase - Supabaseクライアント
 * @param {string} currentUserId - 現在のユーザーID
 * @param {number} diceCount - 振るサイコロの数（デフォルト 1）
 */
export async function actionRollDice(supabase, currentUserId, diceCount = 1) {
    if (!supabase || !currentUserId) return;
    
    const state = await getCurrentPlayerState(supabase, currentUserId);
    if (!state) return;
    const flags = state.flags || {};
    
    if (flags.has_rolled_dice || flags.is_calculating) {
        console.warn("【ガード】既にサイコロを振ったか、計算中のためサイコロを振れません。");
        return;
    }

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

    const newState = await getCurrentPlayerState(supabase, currentUserId);
    if (newState) {
        if (newState.position === 9) { // 子供マス (9)
            console.log("[DEBUG-ACTION] 子供マスに停止。action_land_on_baby を呼び出します。");
            try {
                const babyData = await callRpcWithDebug(supabase, 'action_land_on_baby', {
                    p_room_id: roomId,
                    p_user_id: currentUserId
                });
                
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

    const rawIncome = inputIncomeEl ? inputIncomeEl.value.replace(/,/g, '').trim() : "";
    const rawCashflow = inputCashflowEl ? inputCashflowEl.value.replace(/,/g, '').trim() : "";

    // 数値以外の文字が含まれているか厳密にチェック（マイナス記号は先頭のみ許可）
    if (!/^-?\d+$/.test(rawIncome) || !/^-?\d+$/.test(rawCashflow)) {
        alert('総収入と毎月のキャッシュフローの双方に【半角数字のみ】を正しく入力してください。');
        return;
    }

    const userInputIncome = parseInt(rawIncome, 10);
    const userInputCashflow = parseInt(rawCashflow, 10);

    try {
        const data = await callRpcWithDebug(supabase, 'action_check_calculations', {
            p_room_id: roomId,
            p_user_id: currentUserId,
            p_input_income: userInputIncome,
            p_input_cashflow: userInputCashflow
        });

        if (data.status === 'error') {
            alert(data.message);
        } else {
            alert(data.message); 
            if (inputIncomeEl) inputIncomeEl.value = '';
            if (inputCashflowEl) inputCashflowEl.value = '';
        }
    } catch (error) {
        alert('エラーが発生しました: ' + error.message);
    }
}

/**
 * 銀行ローンを$1,000借り入れる
 */
export async function actionBorrowBankLoan(supabaseClient, userId) {
    if (!supabaseClient || !userId) return;
    const amount = 1000;
    
    if (!confirm(`銀行から $${amount} を借入しますか？\n（借入額の10%が毎月の支払いに加算され、計算チェックが必要になります）`)) return;

    try {
        const result = await callRpcWithDebug(supabaseClient, 'borrow_bank_loan', {
            p_room_id: roomId,
            p_user_id: userId,
            p_amount: amount
        });
        
        if (result && result.status === 'error') {
            alert(`[エラー] ${result.message}`);
        } else if (result && result.status === 'success') {
            alert(result.message);
        }
    } catch (error) {
        alert(`[システムエラー] 借入処理に失敗しました。\n詳細: ${error.message}`);
    }
}

/**
 * 銀行ローンを$1,000返済する
 */
export async function actionRepayBankLoan(supabaseClient, userId) {
    if (!supabaseClient || !userId) return;
    const amount = 1000;
    
    if (!confirm(`銀行ローンを $${amount} 返済しますか？\n（計算チェックが必要になります）`)) return;

    try {
        const result = await callRpcWithDebug(supabaseClient, 'repay_bank_loan', {
            p_room_id: roomId,
            p_user_id: userId,
            p_amount: amount
        });
        
        if (result && result.status === 'error') {
            alert(`[エラー] ${result.message}`);
        } else if (result && result.status === 'success') {
            alert(result.message);
        }
    } catch (error) {
        alert(`[システムエラー] 返済処理に失敗しました。\n詳細: ${error.message}`);
    }
}

console.log("【デバッグ】index_actions.js が読み込まれました。");
