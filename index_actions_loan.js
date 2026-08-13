// index_actions_loan.js
import { roomId } from './common_config.js';
import { SEL_G } from './common_dom_selectors.js';
import { callRpcWithDebug,
         insertSystemMessage,
         getLocalPlayerName,
         writeLog } from './common_utils.js';

export async function actionBorrowBankLoan(supabaseClient, userId) {
    if (!supabaseClient || !userId) return;

    const btn = document.getElementById(SEL_G.LOAN.BTN_BORROW_LOAN);
    if (btn) btn.disabled = true;

    const amount = 1000;
    const playerName = getLocalPlayerName();
    
    try {
        const result = await callRpcWithDebug(supabaseClient, 'borrow_bank_loan_v2', {
            p_room_id: roomId,
            p_user_id: userId,
            p_amount: amount
        });
        
        if (result && result.status === 'error') {
            writeLog(supabaseClient, playerName, "Error", `エラー: ${result.message}`);
        }
    } catch (error) {
        writeLog(supabaseClient, playerName, "Error", `借入処理に失敗しました。: ${error.message}`);
    } finally {
        if (btn) btn.disabled = false;
    }
}

export async function actionRepayBankLoan(supabaseClient, userId) {
    if (!supabaseClient || !userId) return;

    const btn = document.getElementById(SEL_G.LOAN.BTN_PAYBACK_LOAN);
    if (btn) btn.disabled = true;

    const amount = 1000;
    const playerName = getLocalPlayerName();
    
    try {
        const result = await callRpcWithDebug(supabaseClient, 'repay_bank_loan_v2', {
            p_room_id: roomId,
            p_user_id: userId,
            p_amount: amount
        });
        
        if (result && result.status === 'error') {
            writeLog(supabaseClient, playerName, "Error", `エラー: ${result.message}`);
        }
    } catch (error) {
        writeLog(supabaseClient, playerName, "Error", `返済処理に失敗しました。: ${error.message}`);
    } finally {
        if (btn) btn.disabled = false;
    }
}

console.log("【残す】 index_actions_loan.js が正常にロードされました。");
