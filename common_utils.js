// common_utils.js

import { roomId, EXCHANGE_RATE, SHOW_FUNCTION_NAME_IN_MESSAGE } from './common_config.js';
import { SEL_G } from './common_dom_selectors.js';

let localSeqCounter = 0;
export function writeLog(supabaseClient, target, title, body) {
    if (!supabaseClient) return;
    
    const seqNum = Math.floor(Date.now() / 1000) + (localSeqCounter++); 
    
    const bodyStr = typeof body === 'object' ? JSON.stringify(body, null, 2) : String(body);
    
    supabaseClient.from('game_logs').insert([{
        room_id: roomId,
        sequence_num: seqNum,
        target: target,
        title: title,
        body: bodyStr
    }]).then(({ error }) => {
        if (error) {
            console.error("【残す】game_logsへの保存エラー:", error);
        }
    });
}

export async function callRpcWithDebug(supabaseClient, rpcName, params = {}) {
    const startTime = performance.now();
    
    writeLog(supabaseClient, "System", "RPC_CALL_START", `RPC: ${rpcName}\nParams: ${JSON.stringify(params, null, 2)}`);
    
    const { data, error } = await supabaseClient.rpc(rpcName, params);
    
    const endTime = performance.now();
    const executionTime = (endTime - startTime).toFixed(2);

    if (error) {
        writeLog(supabaseClient, "System", "RPC_CALL_FAILED", `RPC: ${rpcName} (${executionTime}ms)\nError: ${JSON.stringify(error, null, 2)}`);
        throw new Error(`RPC実行エラー: ${error.message}`);
    }

    const responseBody = data !== null ? JSON.stringify(data, null, 2) : 'No returning data (void)';
    writeLog(supabaseClient, "System", "RPC_CALL_SUCCESS", `RPC: ${rpcName} (${executionTime}ms)\nResult: ${responseBody}`);

    if (data && typeof data === 'object' && data.status === 'error') {
        writeLog(supabaseClient, "System", "RPC_LOGICAL_WARNING", `RPC: ${rpcName} はエラー状態を返却しました。\nMessage: ${data.message}`);
    }

    return data;
}

export function setButtonActive(id, isActive) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.disabled = !isActive;
    const baseText = btn.innerText.replace(/^[OX]\s/, '');
    btn.innerText = (isActive ? 'O ' : 'X ') + baseText;
}

export function setMultipleButtonsActive(ids, isActive) {
    ids.forEach(id => setButtonActive(id, isActive));
}

export const BOARD_CELL_NAMES = [
    "入金", "娯楽", "商売", "寄付", "商売", "入金", "商売", "娯楽",
    "商売", "子供", "商売", "入金", "市場", "商売", "娯楽", "商売",
    "寄付", "商売", "入金", "商売", "解雇", "商売", "市場", "商売"
];

export function waitForSupabase() {
    return new Promise((resolve) => {
        if (window.supabase) {
            resolve(window.supabase);
            return;
        }
        const interval = setInterval(() => {
            if (window.supabase) {
                clearInterval(interval);
                resolve(window.supabase);
            }
        }, 50);
    });
}

export const CELLS_PAYDAY = [0, 5, 11, 18];
export const CELLS_OPPORTUNITY = [2, 4, 6, 8, 10, 13, 15, 17, 19, 21, 23];
export const CELLS_DOODAD = [1, 7, 14];
export const CELLS_MARKET = [12, 22];
export const CELLS_BABY = [9];
export const CELLS_CHARITY = [3, 16];
export const CELLS_DOWNSIZED = [20];

export function getInitialRegistrationState(username) {
    return {
        name: username,
        role: "general",
        profession: "未定",
        game_phase: "rat_race",
        position: 0,
        last_dice: 0,
        calculation_phase: "none",
        children_count: 0,
        items: [], 
        flags: {
            has_rolled_dice: false,
            is_card_drawn: false,
            is_action_completed: false,
            is_calculating: false,
            is_negative_cash_flow: false,
            charity_turns_left: 0,
            downsized_turns_left: 0,
            pending_paydays: 0
        },
        financials: {
            cash: 0, 
            total_income: 0, 
            total_expenses: 0, 
            passive_income: 0, 
            net_cash_flow: 0, 
            per_child_expense: 0
        }
    };
}

export function getLocalPlayerName() {
    const nameEl = document.getElementById(SEL_G.STATUS.NAME);
    return (nameEl && nameEl.textContent !== '未定') ? nameEl.textContent : 'プレイヤー';
}

export function sendGameProgressMessage(supabaseClient, currentRoomId, targetName, message, funcName = "") {
    if (!supabaseClient) return;
    
    supabaseClient.channel(`room_broadcast_${currentRoomId}`).send({
        type: 'broadcast',
        event: 'progress_update',
        payload: { target: targetName, body: message, funcName: funcName }
    });

    const logMessage = funcName ? `[${funcName}] ${message}` : message;
    writeLog(supabaseClient, targetName, "Message", logMessage);
}

export function displayGameProgressMessage(target, body, funcName = "") {
    // 描画先を上書きされない message-body へ変更
    const el = document.getElementById(SEL_G.MESSAGE.BODY);
    if (!el) return;

    let msgContainer = document.getElementById('game-progress-container');
    if (!msgContainer) {
        msgContainer = document.createElement('div');
        msgContainer.id = 'game-progress-container';
        // el (message-body) の子要素として追加
        el.appendChild(msgContainer);
    }

    const newMsg = document.createElement('div');
    newMsg.className = 'game-progress-message';
    
    let displayBody = body;
    if (SHOW_FUNCTION_NAME_IN_MESSAGE && funcName) {
        displayBody = `[Func: ${funcName}] ${body}`;
    }

    newMsg.innerHTML = `【${new Date().toLocaleTimeString()} 通知: ${target}】${displayBody}`;
    msgContainer.insertBefore(newMsg, msgContainer.firstChild);
}

export function resetMessageDisplayState() {
    const msgContainer = document.getElementById('game-progress-container');
    if (msgContainer) {
        msgContainer.innerHTML = '';
    }
}

export function toYenFormat(dollarValue) {
    const yen = Number(dollarValue || 0) * EXCHANGE_RATE;
    if (yen === 0) return "0円";
    
    let isNegative = false;
    let absYen = yen;
    if (yen < 0) {
        isNegative = true;
        absYen = -yen;
    }

    const oku = Math.floor(absYen / 100000000);
    const man = Math.floor((absYen % 100000000) / 10000);
    const sen = absYen % 10000;

    let result = '';
    if (oku > 0) result += `${oku.toLocaleString()}億`;
    if (man > 0) result += `${man.toLocaleString()}万`;
    if (sen > 0) result += `${sen.toLocaleString()}`;

    if (result === '') result = '0';
    result += '円';

    return isNegative ? `▲${result}` : result;
}

console.log("【残す】common_utils.js が読み込まれました。");
