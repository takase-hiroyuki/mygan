// index_actions_finance.js
import { roomId } from './common_config.js';
import { DOM_SELECTORS } from './common_dom_selectors.js';
import { callRpcWithDebug } from './common_utils.js';
import { displaySystemMessage } from './index_state.js'; // ★変更: index_state.js からインポート

function getLocalPlayerName() {
    const nameEl = document.getElementById(DOM_SELECTORS.GUEST.STATUS.NAME);
    return (nameEl && nameEl.textContent !== '未定') ? nameEl.textContent : 'プレイヤー';
}

export async function actionClaimPaycheck(supabase, currentUserId) {
    if (!supabase || !currentUserId) return;
    
    const playerName = getLocalPlayerName();
    const claimButton = document.getElementById(DOM_SELECTORS.GUEST.CONTROLS.BTN_CLAIM_PAYCHECK);
    if (claimButton) claimButton.disabled = true;

    try {
        await callRpcWithDebug(supabase, 'claim_paycheck', { 
            p_room_id: roomId, 
            p_user_id: currentUserId 
        });
    } catch (error) {
        // ★変更: 引数を (target, body) に変更
        displaySystemMessage(playerName, `処理エラー: ${error.message}`);
        if (claimButton) claimButton.disabled = false;
    }
}

export async function actionCheckCalculations(supabase, currentUserId) {
    if (!supabase || !currentUserId) return;

    const playerName = getLocalPlayerName();
    const inputIncomeEl = document.getElementById(DOM_SELECTORS.GUEST.FINANCIALS.INPUT_TOTAL_INCOME);
    const inputCashflowEl = document.getElementById(DOM_SELECTORS.GUEST.FINANCIALS.INPUT_NET_CASHFLOW);

    const rawIncome = inputIncomeEl ? inputIncomeEl.value.replace(/,/g, '').trim() : "";
    const rawCashflow = inputCashflowEl ? inputCashflowEl.value.replace(/,/g, '').trim() : "";

    if (!/^-?\d+$/.test(rawIncome) || !/^-?\d+$/.test(rawCashflow)) {
        // ★変更: 引数を (target, body) に変更
        displaySystemMessage(playerName, "総収入と毎月のキャッシュフローの双方に【半角数字のみ】を正しく入力してください。");
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
            // ★変更: 引数を (target, body) に変更
            displaySystemMessage(playerName, data.message);
        } else {
            // ★変更: 引数を (target, body) に変更
            displaySystemMessage(playerName, data.message); 
            if (inputIncomeEl) inputIncomeEl.value = '';
            if (inputCashflowEl) inputCashflowEl.value = '';
        }
    } catch (error) {
        // ★変更: 引数を (target, body) に変更
        displaySystemMessage(playerName, `エラーが発生しました: ${error.message}`);
    }
}

console.log("[デバッグ] index_actions_finance.js が正常にロードされました。");
