// index_actions_finance.js
import { roomId } from './common_config.js';
import { SEL_G } from './common_dom_selectors.js'; 
import { callRpcWithDebug, getLocalPlayerName, writeLog } from './common_utils.js';

export async function actionClaimPaycheck(supabase, currentUserId) {
    if (!supabase || !currentUserId) return false;
    try {
        await callRpcWithDebug(supabase, 'claim_paycheck_v2', { 
            p_room_id: roomId, 
            p_user_id: currentUserId 
        });
        return true;
    } catch (error) {
        const playerName = getLocalPlayerName();
        writeLog(supabase, playerName, "Error", `エラー: ${error.message}`);
        return false;
    }
}

export async function actionCheckCalculations(supabase, currentUserId) {
    if (!supabase || !currentUserId) return { error: "無効なリクエスト" };

    const inputIncomeEl = document.getElementById(SEL_G.FINANCIALS.INPUT_TOTAL_INCOME);
    const inputCashflowEl = document.getElementById(SEL_G.FINANCIALS.INPUT_NET_CASHFLOW);

    const rawIncome = inputIncomeEl ? inputIncomeEl.value.replace(/,/g, '').trim() : "";
    const rawCashflow = inputCashflowEl ? inputCashflowEl.value.replace(/,/g, '').trim() : "";

    if (!/^-?\d+$/.test(rawIncome) || !/^-?\d+$/.test(rawCashflow)) {
        return { error: "総収入とキャッシュフローに【半角数字】を入力してください。" };
    }

    const userInputIncome = parseInt(rawIncome, 10);
    const userInputCashflow = parseInt(rawCashflow, 10);
    const playerName = getLocalPlayerName();

    try {
        const data = await callRpcWithDebug(supabase, 'action_check_calculations_v2', {
            p_room_id: roomId,
            p_user_id: currentUserId,
            p_input_income: userInputIncome,
            p_input_cashflow: userInputCashflow
        });

        if (data && data.status === 'error') {
            writeLog(supabase, playerName, "Error", `エラー: ${data.message}`);
            return { error: data.message };
        } else {
            return { success: true };
        }
    } catch (error) {
        writeLog(supabase, playerName, "Error", `エラー: ${error.message}`);
        return { error: error.message };
    }
}

export async function actionOperateItem(supabase, currentUserId) {
    if (!supabase || !currentUserId) return { error: "無効なリクエスト" };
    
    const itemSelect = document.getElementById(SEL_G.FINANCIALS.PROFIT_LOSS_SELECT);
    const operateSelect = document.getElementById(SEL_G.FINANCIALS.PL_OPERATE_SELECT);
    
    if (!itemSelect || !operateSelect) return { error: "DOM要素が見つかりません" };

    const itemId = parseInt(itemSelect.value, 10);
    const operation = operateSelect.value;
    const playerName = getLocalPlayerName();

    if (isNaN(itemId) || !operation) {
        return { error: "対象のアイテムと処理内容の両方を選択してください。" };
    }

    // 選択された項目のテキスト（【売却】〇〇 など）を取得
    const itemText = itemSelect.options[itemSelect.selectedIndex].text;

    try {
        await callRpcWithDebug(supabase, 'operate_participant_item_v2', {
            p_room_id: roomId,
            p_user_id: currentUserId,
            p_item_id: itemId,
            p_operation: operation
        });
        return { success: true, itemText };
    } catch (error) {
        writeLog(supabase, playerName, "Error", `処理エラー: ${error.message}`);
        return { error: error.message };
    }
}

console.log("【残す】 index_actions_finance.js が正常にロードされました。");
