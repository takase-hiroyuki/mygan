// index_ui.js

import { SEL_G } from './common_dom_selectors.js'; 
import { setButtonActive,
         setMultipleButtonsActive,
         BOARD_CELL_NAMES,
         CELLS_OPPORTUNITY,
         CELLS_DOODAD,
         CELLS_MARKET } from './common_utils.js';

const sectionLogin = document.getElementById(SEL_G.LOGIN.SECTION);
const sectionGuest = document.getElementById(SEL_G.STATUS.SECTION);
const diceStatusArea = document.getElementById(SEL_G.CONTROLS.DICE_USER);
const guestDiceResult = document.getElementById(SEL_G.CONTROLS.DICE_RESULT);

let previousTurnUserId = null;

let _cachedParticipantsForSelect = [];
let _currentUserIdForSelect = null;
let _cachedRoomForSelect = null;

export function toggleScreen(isLoggedIn) {
    if (sectionLogin) sectionLogin.hidden = isLoggedIn;
    if (sectionGuest) sectionGuest.hidden = !isLoggedIn;
}

function toCurrency(value) {
    return Number(value || 0).toLocaleString();
}

export async function renderGuestUI(currentUserId, cachedParticipants, cachedRoom, supabaseInstance = null) {
    _currentUserIdForSelect = currentUserId;
    _cachedParticipantsForSelect = cachedParticipants;
    _cachedRoomForSelect = cachedRoom;

    const record = cachedParticipants.find(p => p.user_id === currentUserId);
    if (!record || !record.state) return;

    const state = record.state;
    const financials = state.financials || {};
    const flags = state.flags || {}; 
    const turnUserId = cachedRoom ? cachedRoom.current_turn_user_id : null;
    const isMyTurn = (turnUserId === currentUserId);
    const isPlaying = cachedRoom?.game_state?.status === 'playing';

    if (isPlaying && turnUserId !== previousTurnUserId) {
        const currentTurnUser = cachedParticipants.find(p => p.user_id === turnUserId);
        const targetName = currentTurnUser?.state?.name || "プレイヤー";
        
        await dummyRpcCall('insertSystemMessage', { targetName, message: `${targetName} はサイコロを振って下さい` });
        
        previousTurnUserId = turnUserId;
    }

    const safeUpdate = (selectorId, text) => {
        if (selectorId) {
            const el = document.getElementById(selectorId);
            if (el) el.textContent = text;
        }
    };

    safeUpdate(SEL_G.STATUS.NAME, state.name || "");
    safeUpdate(SEL_G.STATUS.CURRENT_CASH, toCurrency(financials.cash));
    safeUpdate(SEL_G.STATUS.PROFESSION, state.profession || "未定");
    safeUpdate(SEL_G.STATUS.CHILDREN_COUNT, state.children_count || 0);
    safeUpdate(SEL_G.STATUS.PER_CHILD_EXPENSE, toCurrency(financials.per_child_expense));

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
            renderGuestUI(_currentUserIdForSelect, _cachedParticipantsForSelect, _cachedRoomForSelect, supabaseInstance);
        };
    }

    if (Object.keys(financials).length > 0 || state.items) {
        safeUpdate(SEL_G.FINANCIALS.D_CASHFLOW, `キャッシュフロー： ${toCurrency(financials.net_cash_flow)}`);
        
        const selectedUserId = playerSelect ? playerSelect.value : currentUserId;
        const selectedRecord = cachedParticipants.find(p => p.user_id === selectedUserId);
        const selectedState = selectedRecord?.state || {};
        const selectedFinancials = selectedState.financials || {};
        const selectedItems = selectedState.items || [];
        const selectedName = selectedState.name || "不明";
        
        safeUpdate(SEL_G.FINANCIALS.D_PROFESSION, `${selectedName}の職業：${selectedState.profession || '未定'}`);
        safeUpdate(SEL_G.FINANCIALS.D_CASH, `${selectedName}の所持金：$${toCurrency(selectedFinancials.cash)}`);

        let assetsHTML = "<table border='1' width='100%'><tr><th>資産名</th><th>単価</th><th>数量</th><th>CF</th></tr>";
        let liabHTML = "<table border='1' width='100%'><tr><th>負債名</th><th>負債残高</th><th>CF</th></tr>";
        
        let optionsHTML = '<option value="">対象の資産・負債を選択</option>';

        selectedItems.forEach(item => {
            if (item.liability > 0 || item.cashflow < 0) {
                const cfStr = item.cashflow < 0 ? toCurrency(item.cashflow) : `+${toCurrency(item.cashflow)}`;
                liabHTML += `<tr><td>${item.title}</td><td>${item.liability > 0 ? toCurrency(item.liability) : '0'}</td><td>${cfStr}</td></tr>`;
                
                if (item.liability > 0) {
                    optionsHTML += `<option value="${item.id}">【返済】${item.title} (残高: $${toCurrency(item.liability)})</option>`;
                }
            } else {
                const cfStr = item.cashflow <= 0 ? toCurrency(item.cashflow) : `+${toCurrency(item.cashflow)}`;
                
                const unitPrice = item.cost > 0 ? toCurrency(item.cost) : '0';
                const quantity = item.quantity !== undefined ? item.quantity : 1; 
                const quantityStr = Number(quantity).toLocaleString(); 
                
                assetsHTML += `<tr><td>${item.title}</td><td>${unitPrice}</td><td>${quantityStr}</td><td>${cfStr}</td></tr>`;
                
                if (item.cost > 0) {
                    optionsHTML += `<option value="${item.id}">【売却】${item.title} (単価: $${unitPrice}, 数量: ${quantityStr})</option>`;
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

    const turnUserRecord = cachedParticipants.find(p => p.user_id === turnUserId);
    const turnUserState = turnUserRecord ? turnUserRecord.state : {};
    const turnUserFlags = turnUserState.flags || {};
    const turnUserDrawnCard = turnUserState.drawn_card;

    const elNumProcess = document.getElementById(SEL_G.TRADE.NUM_PROCESS_SELF);
    const elBtnProcess = document.getElementById(SEL_G.TRADE.BTN_PROCESS_SELF);
    const elSellTarget = document.getElementById(SEL_G.TRADE.SELECT_TARGET);
    const elSellPrice = document.getElementById(SEL_G.TRADE.INPUT_PRICE);

    if (turnUserDrawnCard) {
        safeUpdate(SEL_G.TRADE.THIS_CARD, `【${turnUserDrawnCard.title}】\n${turnUserDrawnCard.description_jp || ''}`);
        
        if (elNumProcess) {
            const cardType = turnUserDrawnCard.type || '';
            const needsQuantity = ['stock', 'mutual_fund', 'coin'].includes(cardType);
            elNumProcess.hidden = !needsQuantity;
        }

        if (elBtnProcess) {
            if (turnUserState.position !== undefined && CELLS_DOODAD.includes(parseInt(turnUserState.position, 10))) {
                elBtnProcess.textContent = '支払う';
            } else if (turnUserState.position !== undefined && CELLS_MARKET.includes(parseInt(turnUserState.position, 10))) {
                elBtnProcess.textContent = '確認して手番を進める';
            } else {
                elBtnProcess.textContent = '自分で買う / パスする';
            }
        }
        
        if (isMyTurn) {
            setButtonActive(SEL_G.TRADE.BTN_SELL, !!turnUserDrawnCard.is_resellable);
            setButtonActive(SEL_G.TRADE.BTN_PROCESS_SELF, true);
            if (elSellTarget) elSellTarget.disabled = !turnUserDrawnCard.is_resellable;
            if (elSellPrice) elSellPrice.disabled = !turnUserDrawnCard.is_resellable;
        } else {
            setButtonActive(SEL_G.TRADE.BTN_SELL, false);
            setButtonActive(SEL_G.TRADE.BTN_PROCESS_SELF, false);
            if (elSellTarget) elSellTarget.disabled = true;
            if (elSellPrice) elSellPrice.disabled = true;
        }
        
    } else if (turnUserFlags.has_rolled_dice && CELLS_OPPORTUNITY.includes(turnUserState.position) && !turnUserFlags.is_card_drawn) {
        if (isMyTurn) {
            safeUpdate(SEL_G.TRADE.THIS_CARD, "普通の商売、または大きな商売、のどちらかをひいてください");
        } else {
            safeUpdate(SEL_G.TRADE.THIS_CARD, `${turnUserState.name || '他のプレイヤー'} が商売カードを選択中です...`);
        }
        setButtonActive(SEL_G.TRADE.BTN_SELL, false);
        setButtonActive(SEL_G.TRADE.BTN_PROCESS_SELF, false);
        
        if (elNumProcess) elNumProcess.hidden = true;
        if (elSellTarget) elSellTarget.disabled = true;
        if (elSellPrice) elSellPrice.disabled = true;
        if (elBtnProcess) elBtnProcess.textContent = '自分で実行する / 見送る';
    } else {
        safeUpdate(SEL_G.TRADE.THIS_CARD, "場に出たカード");
        setButtonActive(SEL_G.TRADE.BTN_SELL, false);
        setButtonActive(SEL_G.TRADE.BTN_PROCESS_SELF, false);
        
        if (elNumProcess) elNumProcess.hidden = true;
        if (elSellTarget) elSellTarget.disabled = true;
        if (elSellPrice) elSellPrice.disabled = true;
        if (elBtnProcess) elBtnProcess.textContent = '自分で実行する / 見送る';
    }
    
    if (!isPlaying) {
        if (diceStatusArea) diceStatusArea.textContent = "ホストがゲームを開始するまでお待ちください。";
        disableAllActionButtons();
    } else {
        const turnUser = cachedParticipants.find(p => p.user_id === turnUserId);
        const turnUserName = turnUser ? turnUser.state.name : "他のプレイヤー";        

        if (isMyTurn) {
            const pendingPaydays = parseInt(flags.pending_paydays || 0, 10);
            
            setButtonActive(SEL_G.CONTROLS.BTN_PAYCHECK, pendingPaydays > 0);

            if (flags.has_rolled_dice) {
                if (diceStatusArea) {
                    if (pendingPaydays > 0) {
                        diceStatusArea.textContent = `結果:【${state.last_dice}】 入金請求（${pendingPaydays}回分）`;
                    } else {
                        diceStatusArea.textContent = `結果:【${state.last_dice}】`;
                    }
                }
                
                setButtonActive(SEL_G.CONTROLS.BTN_DICE1, false);
                setButtonActive(SEL_G.CONTROLS.BTN_DICE_2, false);
                
                let canEndTurn = false;
                
                if (!flags.is_calculating) {
                    if (financials.cash >= 0) {
                        if (!state.drawn_card || flags.is_action_completed) {
                            canEndTurn = true;
                        }
                    }
                }
                
                setButtonActive(SEL_G.CONTROLS.BTN_END_TURN, canEndTurn);

            } else {
                if (diceStatusArea) diceStatusArea.textContent = "あなたの手番";
                
                const charityTurnsLeft = parseInt(flags.charity_turns_left || 0, 10);
                
                setButtonActive(SEL_G.CONTROLS.BTN_DICE1, true);
                setButtonActive(SEL_G.CONTROLS.BTN_DICE_2, charityTurnsLeft > 0);
                
                setButtonActive(SEL_G.CONTROLS.BTN_END_TURN, false);
                
                setMultipleButtonsActive([
                    SEL_G.CARD.BTN_SMALL_DEAL, 
                    SEL_G.CARD.BTN_BIG_DEAL
                ], false);
            }
            
            setButtonActive(SEL_G.FINANCIALS.BTN_C_CASHFLOW, !!flags.is_calculating);
            
            setButtonActive(SEL_G.LOAN.BTN_BORROW_LOAN, true);
            setButtonActive(SEL_G.LOAN.BTN_PAYBACK_LOAN, true);

            setButtonActive(SEL_G.FINANCIALS.BTN_OPERATE, true);
            
        } else {
            if (diceStatusArea) diceStatusArea.textContent = `[${turnUserName}] がプレイ中`;
            disableAllActionButtons();
        }
    }

    // =========================================================================
    // ★ 追加・修正箇所：交渉（トレード）状態の監視とUI反映
    // disableAllActionButtons() の後に実行することで、非手番でもボタンを有効化する
    // =========================================================================
    const tradeOffer = cachedRoom?.game_state?.trade_offer;
    
    if (tradeOffer) {
        if (tradeOffer.to === currentUserId) {
            // 自分への提案が来ている場合
            const fromUser = cachedParticipants.find(p => p.user_id === tradeOffer.from);
            const fromName = fromUser?.state?.name || "他のプレイヤー";
            safeUpdate(SEL_G.TRADE.TRADE_MESSAGE, `${fromName} さんから $${toCurrency(tradeOffer.price)} で権利を買う提案が来ています。`);
            
            // 自分の手番でなくても、承諾/拒否ボタンだけは有効にする
            setButtonActive(SEL_G.TRADE.BTN_ACCEPT, true);
            setButtonActive(SEL_G.TRADE.BTN_REJECT, true);
            
        } else if (tradeOffer.from === currentUserId) {
            // 自分が提案中の場合
            const toUser = cachedParticipants.find(p => p.user_id === tradeOffer.to);
            const toName = toUser?.state?.name || "他のプレイヤー";
            safeUpdate(SEL_G.TRADE.TRADE_MESSAGE, `${toName} さんからの返答を待っています...`);
            setButtonActive(SEL_G.TRADE.BTN_ACCEPT, false);
            setButtonActive(SEL_G.TRADE.BTN_REJECT, false);
            
        } else {
            // 当事者以外
            safeUpdate(SEL_G.TRADE.TRADE_MESSAGE, "他プレイヤー間で交渉中です...");
            setButtonActive(SEL_G.TRADE.BTN_ACCEPT, false);
            setButtonActive(SEL_G.TRADE.BTN_REJECT, false);
        }
    } else {
        safeUpdate(SEL_G.TRADE.TRADE_MESSAGE, "受け取るメッセージ (現在交渉なし)");
        setButtonActive(SEL_G.TRADE.BTN_ACCEPT, false);
        setButtonActive(SEL_G.TRADE.BTN_REJECT, false);
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
        CONTROLS.BTN_DICE1,
        CONTROLS.BTN_DICE_2,
        CONTROLS.BTN_PAYCHECK, 
        CONTROLS.BTN_END_TURN,
        CARD.BTN_SMALL_DEAL,
        CARD.BTN_BIG_DEAL,
        LOAN.BTN_BORROW_LOAN,
        LOAN.BTN_PAYBACK_LOAN, 
        FINANCIALS.BTN_C_CASHFLOW,
        FINANCIALS.BTN_OPERATE,
        TRADE.BTN_SELL,
        TRADE.BTN_ACCEPT,
        TRADE.BTN_REJECT,
        TRADE.BTN_PROCESS_SELF
    ];
    
    setMultipleButtonsActive(actionButtonIds.filter(Boolean), false);
}

export async function dummyRpcCall(rpcName, payload) {
    console.log(`[Dummy RPC] 実行されました: ${rpcName}`, payload);
    return { data: null, error: null };
}

console.log("【デバッグ】index_ui.js が読み込まれました。");
