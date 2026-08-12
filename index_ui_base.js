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

function toCurrency(value) {
    return Number(value || 0).toLocaleString();
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
    
    // (1人あたり) がHTML側にもあるためJS側では付与しないよう修正
    safeUpdate(SEL_G.STATUS.PER_CHILD_EXPENSE, toYenFormat(financials.per_child_expense));

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
                // toYenFormat がマイナス時に '▲' を返すため、プラス時のみ '+' を明示
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
