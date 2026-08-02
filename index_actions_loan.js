// index_actions_loan.js
import { roomId } from './common_config.js';
import { SEL_G } from './common_dom_selectors.js';
import { callRpcWithDebug,
        insertSystemMessage,
        getLocalPlayerName } from './common_utils.js';

export async function actionBorrowBankLoan(supabaseClient, userId) {
    if (!supabaseClient || !userId) return;
    const amount = 1000;
    const playerName = getLocalPlayerName();
    
    try {
        const result = await callRpcWithDebug(supabaseClient, 'borrow_bank_loan_v2', {
            p_room_id: roomId,
            p_user_id: userId,
            p_amount: amount
        });
        
        if (result && result.status === 'error') {
            await insertSystemMessage(supabaseClient, playerName, `エラー: ${result.message}`);
        }
    } catch (error) {
        await insertSystemMessage(supabaseClient, playerName, `借入処理に失敗しました。: ${error.message}`);
    }
}

export async function actionRepayBankLoan(supabaseClient, userId) {
    if (!supabaseClient || !userId) return;
    const amount = 1000;
    const playerName = getLocalPlayerName();
    
    try {
        const result = await callRpcWithDebug(supabaseClient, 'repay_bank_loan_v2', {
            p_room_id: roomId,
            p_user_id: userId,
            p_amount: amount
        });
        
        if (result && result.status === 'error') {
            await insertSystemMessage(supabaseClient, playerName, `エラー: ${result.message}`);
        }
    } catch (error) {
        await insertSystemMessage(supabaseClient, playerName, `返済処理に失敗しました。: ${error.message}`);
    }
}

console.log("[デバッグ] index_actions_loan.js が正常にロードされました。");
