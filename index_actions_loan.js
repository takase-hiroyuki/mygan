// index_actions_loan.js
import { roomId } from './common_config.js';
import { DOM_SELECTORS } from './common_dom_selectors.js';
import { callRpcWithDebug } from './common_utils.js';
import { displaySystemMessage } from './index_state.js'; // ★変更: index_state.js からインポート

function getLocalPlayerName() {
    const nameEl = document.getElementById(DOM_SELECTORS.GUEST.STATUS.NAME);
    return (nameEl && nameEl.textContent !== '未定') ? nameEl.textContent : 'プレイヤー';
}

export async function actionBorrowBankLoan(supabaseClient, userId) {
    if (!supabaseClient || !userId) return;
    const amount = 1000;
    const playerName = getLocalPlayerName();
    
    // confirmダイアログは禁止事項に該当するため削除し、即時実行とする

    try {
        const result = await callRpcWithDebug(supabaseClient, 'borrow_bank_loan_v2', {
            p_room_id: roomId,
            p_user_id: userId,
            p_amount: amount
        });
        
        if (result && result.status === 'error') {
            displaySystemMessage(playerName, `[エラー] ${result.message}`);
        }
        // 成功時のシステムメッセージは game_logs テーブル経由で配信されるためローカル表示しない
    } catch (error) {
        displaySystemMessage(playerName, `[システムエラー] 借入処理に失敗しました。詳細: ${error.message}`);
    }
}

export async function actionRepayBankLoan(supabaseClient, userId) {
    if (!supabaseClient || !userId) return;
    const amount = 1000;
    const playerName = getLocalPlayerName();
    
    // confirmダイアログは禁止事項に該当するため削除し、即時実行とする

    try {
        const result = await callRpcWithDebug(supabaseClient, 'repay_bank_loan_v2', {
            p_room_id: roomId,
            p_user_id: userId,
            p_amount: amount
        });
        
        if (result && result.status === 'error') {
            displaySystemMessage(playerName, `[エラー] ${result.message}`);
        }
        // 成功時のシステムメッセージは game_logs テーブル経由で配信されるためローカル表示しない
    } catch (error) {
        displaySystemMessage(playerName, `[システムエラー] 返済処理に失敗しました。詳細: ${error.message}`);
    }
}

console.log("[デバッグ] index_actions_loan.js が正常にロードされました。");
