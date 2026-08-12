// common_utils.js

import { roomId } from './common_config.js';
import { SEL_G } from './common_dom_selectors.js';

let localSeqCounter = 0;
export function writeLog(supabaseClient, target, title, body) {
    if (!supabaseClient) return;
    
    // sequence_numは integer 型 (上限約21.4億) のため、現在時刻(秒) + ローカルカウンターで一意性と順序を担保
    const seqNum = Math.floor(Date.now() / 1000) + (localSeqCounter++); 
    
    const bodyStr = typeof body === 'object' ? JSON.stringify(body, null, 2) : String(body);
    
    // ※UI処理をブロックしないよう、awaitせずに非同期でINSERTを投げる
    supabaseClient.from('game_logs').insert([{
        room_id: roomId,
        sequence_num: seqNum,
        target: target,
        title: title,
        body: bodyStr
    }]).then(({ error }) => {
        if (error) {
            // スクリプトエラー等でDBに書き込めない異常事態のみ、コンソールに残す
            console.error("【残す】game_logsへの保存エラー:", error);
        }
    });
}

// SupabaseのRPC関数を安全に呼び出し、入出力をデバッグするためのラッパー関数。
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

    // 整合性監視: RPC関数側で定義された論理エラー（JSONBのstatus: 'error'）の検知
    if (data && typeof data === 'object' && data.status === 'error') {
        writeLog(supabaseClient, "System", "RPC_LOGICAL_WARNING", `RPC: ${rpcName} はエラー状態を返却しました。\nMessage: ${data.message}`);
    }

    return data;
}

// 単一のボタンの有効/無効とテキストプレフィックス(O/X)を同期する
export function setButtonActive(id, isActive) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.disabled = !isActive;
    const baseText = btn.innerText.replace(/^[OX]\s/, '');
    btn.innerText = (isActive ? 'O ' : 'X ') + baseText;
}

// 複数のボタンの一括状態変更を行う
export function setMultipleButtonsActive(ids, isActive) {
    ids.forEach(id => setButtonActive(id, isActive));
}

export const BOARD_CELL_NAMES = [
    "入金", "娯楽", "商売", "寄付", "商売", "入金", "商売", "娯楽",
    "商売", "子供", "商売", "入金", "市場", "商売", "娯楽", "商売",
    "寄付", "商売", "入金", "商売", "解雇", "商売", "市場", "商売"
];

// window.supabase のロードを安全に待機する関数
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

// 盤面の特定のマスを示す定数 (CELLS_... 形式に統一)
export const CELLS_PAYDAY = [0, 5, 11, 18];        // 入金（給料マイナス経費）
export const CELLS_OPPORTUNITY = [2, 4, 6, 8, 10, 13, 15, 17, 19, 21, 23]; // 商売
export const CELLS_DOODAD = [1, 7, 14];            // 娯楽
export const CELLS_MARKET = [12, 22];              // 市場
export const CELLS_BABY = [9];                     // 子供
export const CELLS_CHARITY = [3, 16];              // 寄付
export const CELLS_DOWNSIZED = [20];               // 解雇

// プレイヤーの初期登録データを生成する関数
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

        // すべての資産・負債・固定費・給料はここにアイテムとして入る
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
            // お財布の状況（現金）や、キャッシュフローの合計値など、
            // 「アイテムの計算結果」や「現在の状態」を入れる場所だけ残す
            cash: 0, 
            total_income: 0, 
            total_expenses: 0, 
            passive_income: 0, 
            net_cash_flow: 0, 
            per_child_expense: 0
        }
    };
}

// 画面（DOM）から現在のプレイヤー名を取得するヘルパー関数
export function getLocalPlayerName() {
    const nameEl = document.getElementById(SEL_G.STATUS.NAME);
    return (nameEl && nameEl.textContent !== '未定') ? nameEl.textContent : 'プレイヤー';
}

export async function insertSystemMessage(supabase, targetName, message) {
    writeLog(supabase, targetName, "Message", message);
    return { data: null, error: null };
}

/**
 * システムメッセージを表示するためのシンプルな関数
 * キューを使わず、既存の画面上部にメッセージを追記していく方式
 */
export function displaySystemMessage(target, body) {
    const el = document.getElementById(SEL_G.TRADE.THIS_CARD);
    if (!el) return;

    // メッセージ用のコンテナを特定、なければ作成
    let msgContainer = document.getElementById('sys-msg-container');
    if (!msgContainer) {
        msgContainer = document.createElement('div');
        msgContainer.id = 'sys-msg-container';
        // コンテナを常に一番上に表示
        el.insertBefore(msgContainer, el.firstChild);
    }

    // 新しいメッセージ要素を作成
    const newMsg = document.createElement('div');
    newMsg.style.color = '#d32f2f';
    newMsg.style.fontWeight = 'bold';
    newMsg.style.margin = '4px 0';
    newMsg.style.border = '1px solid #d32f2f';
    newMsg.style.padding = '5px';
    newMsg.style.backgroundColor = '#fff0f0';
    newMsg.innerHTML = `【${new Date().toLocaleTimeString()} 通知: ${target}】${body}`;

    // コンテナの先頭に新しいメッセージを追加
    msgContainer.insertBefore(newMsg, msgContainer.firstChild);
}

/**
 * 画面が大きく再描画された際にメッセージコンテナが消えるのを防ぐため、
 * 再描画後に呼び出すか、CSSなどで制御してください。
 */
export function resetMessageDisplayState() {
    // 必要に応じてコンテナをクリアする関数
    const msgContainer = document.getElementById('sys-msg-container');
    if (msgContainer) {
        msgContainer.innerHTML = '';
    }
}

/**
 * ドル数値を日本円（1ドル160円換算）の文字列に変換する関数
 * 「◯億◯万◯千円」のような日本語フォーマットで出力する
 */
export function toYenFormat(dollarValue) {
    const yen = Number(dollarValue || 0) * 160;
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

    return isNegative ? `-${result}` : result;
}

console.log("【残す】common_utils.js が読み込まれました。");

// index_ui_base.js
import { SEL_G } from './common_dom_selectors.js';
import { BOARD_CELL_NAMES, setMultipleButtonsActive, toYenFormat } from './common_utils.js';

const sectionLogin = document.getElementById(SEL_G.LOGIN.SECTION);
const sectionGuest = document.getElementById(SEL_G.STATUS.SECTION);
const guestDiceResult = document.getElementById(SEL_G.CONTROLS.DICE_RESULT);

export function toggleScreen(isLoggedIn) {
    if (sectionLogin) sectionLogin.hidden = isLoggedIn;
    if (sectionGuest) sectionGuest.hidden = !isLoggedIn;
}

export function renderBaseUI(currentUserId, cachedParticipants, cachedRoom, onReRenderCallback) {
    const record = cachedParticipants.find(p => p.user_id === currentUserId);
    if (!record || !record.state) return;

    const state = record.state;
    const financials = state.financials || {};

    const safeUpdate = (selectorId, text) => {
        const el = document.getElementById(selectorId);
        if (el) el.textContent = text;
    };

    // 場に出ているカード（current_card）を取得（部屋データから優先、なければ誰かのdrawn_cardから）
    const activeCard = cachedRoom?.game_state?.current_card || 
                       cachedParticipants.find(p => p.state && p.state.drawn_card)?.state.drawn_card || null;
    const currentTurnUserId = cachedRoom?.current_turn_user_id;
    const isTurnUser = currentTurnUserId === currentUserId;

    let isHit = false;
    if (activeCard && state.items) {
        isHit = state.items.some(item => {
            if (activeCard.asset_type !== 'other') {
                return item.asset_type === activeCard.asset_type;
            } else {
                if (activeCard.action_rule) {
                    if (activeCard.action_rule.target_symbol && item.asset_type === activeCard.action_rule.target_symbol) {
                        return true;
                    }
                    if (Array.isArray(activeCard.action_rule.target_asset) && activeCard.action_rule.target_asset.includes(item.asset_type)) {
                        return true;
                    }
                }
                return false;
            }
        });
    }

    const hitSelector = SEL_G.STATUS.HIT || 'hit';
    safeUpdate(hitSelector, isHit ? "★該当あり " : "");

    safeUpdate(SEL_G.STATUS.NAME, state.name || "");
    safeUpdate(SEL_G.STATUS.CURRENT_CASH, toYenFormat(financials.cash));
    safeUpdate(SEL_G.STATUS.PROFESSION, state.profession || "未定");
    safeUpdate(SEL_G.STATUS.CHILDREN_COUNT, state.children_count || 0);
    safeUpdate(SEL_G.STATUS.PER_CHILD_EXPENSE, `${toYenFormat(financials.per_child_expense)}(1人あたり)`);

    for (let i = 0; i < 24; i++) {
        const cell = document.getElementById(`${SEL_G.BOARD.RAT_PREFIX}${i}`);
        if (cell) cell.innerHTML = "";
    }
    
    cachedParticipants.forEach(p => {
        if (p.state && p.state.position !== undefined) {
            const cell = document.getElementById(`${SEL_G.BOARD.RAT_PREFIX}${parseInt(p.state.position, 10)}`);
            if (cell) {
                const badge = document.createElement('span');
                badge.textContent = p.state.name;
                cell.appendChild(badge);
            }
        }
    });

    const playerSelect = document.getElementById(SEL_G.FINANCIALS.PLAYER_SELECT);
    if (playerSelect) {
        const currentValue = playerSelect.value;
        playerSelect.innerHTML = '';
        
        cachedParticipants.forEach(p => {
            if (p.state && p.state.name) {
                const option = document.createElement('option');
                option.value = p.user_id;
                option.textContent = p.state.name + ' の財務諸表';
                playerSelect.appendChild(option);
            }
        });
        
        if (currentValue && cachedParticipants.some(p => p.user_id === currentValue)) {
            playerSelect.value = currentValue;
        } else {
            playerSelect.value = currentUserId;
        }

        playerSelect.onchange = () => {
            if (onReRenderCallback) onReRenderCallback();
        };
    }

    if (Object.keys(financials).length > 0 || state.items) {
        safeUpdate(SEL_G.FINANCIALS.D_CASHFLOW, `キャッシュフロー： ${toYenFormat(financials.net_cash_flow)}`);
        
        const selectedUserId = playerSelect ? playerSelect.value : currentUserId;
        const selectedRecord = cachedParticipants.find(p => p.user_id === selectedUserId);
        const selectedState = selectedRecord?.state || {};
        const selectedFinancials = selectedState.financials || {};
        const selectedItems = selectedState.items || [];
        const selectedName = selectedState.name || "不明";
        
        safeUpdate(SEL_G.FINANCIALS.D_PROFESSION, `${selectedName}の職業：${selectedState.profession || '未定'}`);
        safeUpdate(SEL_G.FINANCIALS.D_CASH, `${selectedName}の所持金：${toYenFormat(selectedFinancials.cash)}`);

        let assetsHTML = "<table border='1' width='100%'><tr><th>資産名</th><th>単価</th><th>数量</th><th>CF</th></tr>";
        let liabHTML = "<table border='1' width='100%'><tr><th>負債名</th><th>負債残高</th><th>CF</th></tr>";
        let optionsHTML = '<option value="">対象の資産・負債を選択</option>';

        let totalExpenses = 0;
        let passiveIncome = 0;
        let hasHouse = false;

        selectedItems.forEach(item => {
            const costVal = Number(item.cost || 0);
            const liabVal = Number(item.liability || 0);
            const cfVal = Number(item.cashflow || 0);

            if (item.asset_type === 'House') hasHouse = true;

            if (cfVal < 0) {
                totalExpenses += Math.abs(cfVal);
            } else if (cfVal > 0 && costVal > 0) {
                passiveIncome += cfVal;
            }

            // --- 資産の表示と売却判定 ---
            if (costVal > 0 || (liabVal === 0 && cfVal > 0)) {
                const cfStr = cfVal <= 0 ? toYenFormat(cfVal) : `+${toYenFormat(cfVal)}`;
                const unitPrice = toYenFormat(costVal);
                const quantity = item.quantity !== undefined ? item.quantity : 1; 
                const quantityStr = Number(quantity).toLocaleString(); 
                
                assetsHTML += `<tr><td>${item.title}</td><td>${unitPrice}</td><td>${quantityStr}</td><td>${cfStr}</td></tr>`;
                
                if (costVal > 0) {
                    let canSell = false;
                    
                    // バックエンド(operate_participant_item_v2)と整合させた売却可否判定
                    if (activeCard) {
                        // 1. 売却権限のチェック
                        const hasSellRight = (activeCard.sell === 'all') || (activeCard.sell === 'owner' && isTurnUser);
                        
                        if (hasSellRight) {
                            // 2. 対象資産の合致判定 (SQLの3パターンと同等)
                            const cardActionRule = activeCard.action_rule || {};
                            
                            // パターン1: target_symbolの完全一致
                            if (cardActionRule.target_symbol && cardActionRule.target_symbol === item.asset_type) {
                                canSell = true;
                            }
                            // パターン2: target_asset 配列に含まれるか
                            else if (Array.isArray(cardActionRule.target_asset) && cardActionRule.target_asset.includes(item.asset_type)) {
                                canSell = true;
                            }
                            // パターン3: 通常のasset_type一致
                            else if (activeCard.asset_type && activeCard.asset_type !== 'other' && activeCard.asset_type === item.asset_type) {
                                canSell = true;
                            }
                            
                            // ※フロントエンドでは複雑化を防ぐため、min_units(最低部屋数)のチェックは省略し、サーバー側で弾かせる運用とする
                        }
                    }
                    
                    if (canSell) {
                        optionsHTML += `<option value="${item.id}">【売却】${item.title} (単価: ${unitPrice}, 数量: ${quantityStr})</option>`;
                    }
                }
            }

            // --- 負債の表示と返済判定 ---
            if (liabVal > 0 || (cfVal < 0 && costVal === 0)) {
                let displayName = item.title;
                let displayCF = cfVal;
                
                if (costVal > 0 && liabVal > 0) {
                    displayName = item.title + "のローン";
                    displayCF = 0; 
                }

                const cfStr = displayCF < 0 ? toYenFormat(displayCF) : `+${toYenFormat(displayCF)}`;
                const liabStr = liabVal > 0 ? toYenFormat(liabVal) : '0円';
                
                liabHTML += `<tr><td>${displayName}</td><td>${liabStr}</td><td>${cfStr}</td></tr>`;
                
                if (liabVal > 0) {
                    if (costVal === 0) {
                        optionsHTML += `<option value="${item.id}">【返済】${displayName} (残高: ${liabStr})</option>`;
                    }
                }
            }
        });
        
        assetsHTML += "</table>";
        liabHTML += "</table>";

        const elProfit = document.getElementById(SEL_G.FINANCIALS.D_PROFIT);
        if (elProfit) elProfit.innerHTML = assetsHTML;

        const elLoss = document.getElementById(SEL_G.FINANCIALS.D_LOSS);
        if (elLoss) elLoss.innerHTML = liabHTML;
        
        const elProfitLossSelect = document.getElementById(SEL_G.FINANCIALS.PROFIT_LOSS_SELECT);
        if (elProfitLossSelect) elProfitLossSelect.innerHTML = optionsHTML;

        const elOperateSelect = document.getElementById(SEL_G.FINANCIALS.PL_OPERATE_SELECT);
        if (elOperateSelect) {
            const currentOp = elOperateSelect.value;
            let operateHTML = '<option value="">処理の内容を選択</option>';
            operateHTML += '<option value="sell">資産を売却する。現金が増える</option>';
            operateHTML += '<option value="payoff">負債を返済する。現金は、減る</option>';

            if (activeCard && activeCard.id === 122 && hasHouse && isTurnUser) {
                operateHTML += '<option value="sell_bonus_50000">このHouseを、+800万円で特殊売却する</option>';
            }
            
            elOperateSelect.innerHTML = operateHTML;
            if (currentOp && elOperateSelect.querySelector(`option[value="${currentOp}"]`)) {
                elOperateSelect.value = currentOp;
            }
        }

        const btnFastTrack = document.getElementById(SEL_G.FINANCIALS.BTN_FAST_TRACK);
        if (btnFastTrack) {
            const diffToFastTrack = totalExpenses - passiveIncome;
            if (diffToFastTrack > 0) {
                btnFastTrack.textContent = `ファーストトラックまで、あと${toYenFormat(diffToFastTrack)}`;
            } else {
                btnFastTrack.textContent = `ファーストトラックへ移行可能！`;
            }
        }
    }

    const sellTargetSelect = document.getElementById(SEL_G.TRADE.SELECT_TARGET);
    if (sellTargetSelect) {
        const currentTarget = sellTargetSelect.value; 
        sellTargetSelect.innerHTML = '<option value="">だれに</option>';
        cachedParticipants.forEach(p => {
            if (p.user_id !== currentUserId && p.state && p.state.name) {
                const option = document.createElement('option');
                option.value = p.user_id;
                option.textContent = p.state.name;
                sellTargetSelect.appendChild(option);
            }
        });
        if (currentTarget && cachedParticipants.some(p => p.user_id === currentTarget)) {
            sellTargetSelect.value = currentTarget;
        }
    }

    if (guestDiceResult && state.position !== undefined) {
        const posNum = state.position;
        const posStr = String(posNum).padStart(2, '0');
        const cellName = BOARD_CELL_NAMES[posNum] || "";
        guestDiceResult.textContent = `現在地：${posStr}${cellName}`;
    }
}

export function disableAllActionButtons() {
    const { CONTROLS, CARD, LOAN, FINANCIALS, TRADE } = SEL_G; 
    const actionButtonIds = [
        CONTROLS.BTN_DICE1, CONTROLS.BTN_DICE_2, CONTROLS.BTN_PAYCHECK, CONTROLS.BTN_END_TURN,
        CARD.BTN_SMALL_DEAL, CARD.BTN_BIG_DEAL,
        LOAN.BTN_BORROW_LOAN, LOAN.BTN_PAYBACK_LOAN, 
        FINANCIALS.BTN_C_CASHFLOW, FINANCIALS.BTN_OPERATE,
        TRADE.BTN_SELL, TRADE.BTN_ACCEPT, TRADE.BTN_REJECT, TRADE.BTN_PROCESS_SELF
    ];
    setMultipleButtonsActive(actionButtonIds.filter(Boolean), false);
}

console.log("【残す】index_ui_base.js が読み込まれました。");
