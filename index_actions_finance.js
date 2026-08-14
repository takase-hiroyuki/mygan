// index_actions_finance.js
import { roomId } from './common_config.js';
import { SEL_G } from './common_dom_selectors.js'; 
import { callRpcWithDebug, sendGameProgressMessage, getLocalPlayerName, writeLog } from './common_utils.js';

export async function actionClaimPaycheck(supabase, currentUserId) {
    if (!supabase || !currentUserId) return;
    
    const playerName = getLocalPlayerName();
    const claimButton = document.getElementById(SEL_G.CONTROLS.BTN_CLAIM_PAYCHECK);
    if (claimButton) claimButton.disabled = true;

    try {
        await callRpcWithDebug(supabase, 'claim_paycheck_v2', { 
            p_room_id: roomId, 
            p_user_id: currentUserId 
        });
    } catch (error) {
        writeLog(supabase, playerName, "Error", `エラー: ${error.message}`);
        if (claimButton) claimButton.disabled = false;
    }
}

export async function actionCheckCalculations(supabase, currentUserId) {
    if (!supabase || !currentUserId) return;

    const playerName = getLocalPlayerName();
    const inputIncomeEl = document.getElementById(SEL_G.FINANCIALS.INPUT_TOTAL_INCOME);
    const inputCashflowEl = document.getElementById(SEL_G.FINANCIALS.INPUT_NET_CASHFLOW);

    const rawIncome = inputIncomeEl ? inputIncomeEl.value.replace(/,/g, '').trim() : "";
    const rawCashflow = inputCashflowEl ? inputCashflowEl.value.replace(/,/g, '').trim() : "";

    if (!/^-?\d+$/.test(rawIncome) || !/^-?\d+$/.test(rawCashflow)) {
        sendGameProgressMessage(supabase, roomId, playerName, "総収入とキャッシュフローに【半角数字】を入力してください。", "actionCheckCalculations");
        return;
    }

    const userInputIncome = parseInt(rawIncome, 10);
    const userInputCashflow = parseInt(rawCashflow, 10);

    try {
        const data = await callRpcWithDebug(supabase, 'action_check_calculations_v2', {
            p_room_id: roomId,
            p_user_id: currentUserId,
            p_input_income: userInputIncome,
            p_input_cashflow: userInputCashflow
        });

        if (data && data.status === 'error') {
            writeLog(supabase, playerName, "Error", `エラー: ${data.message}`);
        } else {
            if (inputIncomeEl) inputIncomeEl.value = '';
            if (inputCashflowEl) inputCashflowEl.value = '';
        }
    } catch (error) {
        writeLog(supabase, playerName, "Error", `エラー: ${error.message}`);
    }
}

export async function actionOperateItem(supabase, currentUserId) {
    if (!supabase || !currentUserId) return;
    const playerName = getLocalPlayerName();

    const itemSelect = document.getElementById(SEL_G.FINANCIALS.PROFIT_LOSS_SELECT);
    const operateSelect = document.getElementById(SEL_G.FINANCIALS.PL_OPERATE_SELECT);
    
    if (!itemSelect || !operateSelect) return;

    const itemId = parseInt(itemSelect.value, 10);
    const operation = operateSelect.value;

    if (isNaN(itemId) || !operation) {
        sendGameProgressMessage(supabase, roomId, playerName, "対象のアイテムと処理内容の両方を選択してください。", "actionOperateItem");
        return;
    }

    try {
        await callRpcWithDebug(supabase, 'operate_participant_item_v2', {
            p_room_id: roomId,
            p_user_id: currentUserId,
            p_item_id: itemId,
            p_operation: operation
        });
        
        sendGameProgressMessage(supabase, roomId, playerName, "資産・負債の処理が完了しました。", "actionOperateItem");
        
        itemSelect.value = "";
        operateSelect.value = "";
    } catch (error) {
        writeLog(supabase, playerName, "Error", `処理エラー: ${error.message}`);
    }
}

console.log("【残す】 index_actions_finance.js が正常にロードされました。");
