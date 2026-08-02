// index_actions_finance.js
import { roomId } from './common_config.js';
import { SEL_G } from './common_dom_selectors.js'; 
import { callRpcWithDebug, displaySystemMessage, insertSystemMessage, getLocalPlayerName } from './common_utils.js'; // ★修正: insertSystemMessage をインポートに追加

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
        // ★修正: DBに永続化するため insertSystemMessage に変更
        await insertSystemMessage(supabase, playerName, `エラー: ${error.message}`);
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
        // ★修正: DBに永続化するため insertSystemMessage に変更
        await insertSystemMessage(supabase, playerName, "総収入とキャッシュフローに【半角数字】を入力してください。");
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
            // ★修正: DBに永続化するため insertSystemMessage に変更
            await insertSystemMessage(supabase, playerName, `エラー: ${data.message}`);
        } else {
            if (inputIncomeEl) inputIncomeEl.value = '';
            if (inputCashflowEl) inputCashflowEl.value = '';
        }
    } catch (error) {
        // ★修正: DBに永続化するため insertSystemMessage に変更
        await insertSystemMessage(supabase, playerName, `エラー: ${error.message}`);
    }
}

console.log("[デバッグ] index_actions_finance.js が正常にロードされました。");
