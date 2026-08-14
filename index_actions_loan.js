// index_actions_loan.js
import { roomId } from './common_config.js';
import { callRpcWithDebug, getLocalPlayerName, writeLog } from './common_utils.js';

export async function actionBorrowBankLoan(supabaseClient, userId) {
    if (!supabaseClient || !userId) return { error: "無効なリクエスト" };

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
            return { error: result.message };
        } else {
            return { success: true };
        }
    } catch (error) {
        writeLog(supabaseClient, playerName, "Error", `借入処理に失敗しました。: ${error.message}`);
        return { error: error.message };
    }
}

export async function actionRepayBankLoan(supabaseClient, userId) {
    if (!supabaseClient || !userId) return { error: "無効なリクエスト" };

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
            return { error: result.message };
        } else {
            return { success: true };
        }
    } catch (error) {
        writeLog(supabaseClient, playerName, "Error", `返済処理に失敗しました。: ${error.message}`);
        return { error: error.message };
    }
}

console.log("【残す】 index_actions_loan.js が正常にロードされました。");
