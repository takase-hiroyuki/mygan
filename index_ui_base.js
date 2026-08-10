// index_ui_base.js
import { SEL_G } from './common_dom_selectors.js';
import { BOARD_CELL_NAMES, setMultipleButtonsActive } from './common_utils.js';

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

        // プルダウン変更時は、index.js から渡された再描画関数を実行する
        playerSelect.onchange = () => {
            if (onReRenderCallback) onReRenderCallback();
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
            // 変数を数値化して扱いやすくする
            const costVal = Number(item.cost || 0);
            const liabVal = Number(item.liability || 0);
            const cfVal = Number(item.cashflow || 0);

            // 1. 資産の部への出力判定
            // 実体価値(cost > 0)があるか、または純粋なプラスのCFを生み出す(給料など)もの
            if (costVal > 0 || (liabVal === 0 && cfVal > 0)) {
                const cfStr = cfVal <= 0 ? toCurrency(cfVal) : `+${toCurrency(cfVal)}`;
                const unitPrice = toCurrency(costVal);
                const quantity = item.quantity !== undefined ? item.quantity : 1; 
                const quantityStr = Number(quantity).toLocaleString(); 
                
                assetsHTML += `<tr><td>${item.title}</td><td>${unitPrice}</td><td>${quantityStr}</td><td>${cfStr}</td></tr>`;
                
                // 売却可能なのは cost(単価) が設定されているものだけにする
                if (costVal > 0) {
                    optionsHTML += `<option value="${item.id}">【売却】${item.title} (単価: $${unitPrice}, 数量: ${quantityStr})</option>`;
                }
            }

            // 2. 負債の部への出力判定
            // 負債残高(liability > 0)があるか、または純粋なマイナスのCF(税金など)のもの
            if (liabVal > 0 || (cfVal < 0 && costVal === 0)) {
                let displayName = item.title;
                let displayCF = cfVal;
                
                // アパートなどの「資産に紐づくローン」の場合は表示名を変え、CF表示をゼロ(資産側に計上済みのため)にする
                if (costVal > 0 && liabVal > 0) {
                    displayName = item.title + "のローン";
                    displayCF = 0; 
                }

                const cfStr = displayCF < 0 ? toCurrency(displayCF) : `+${toCurrency(displayCF)}`;
                const liabStr = liabVal > 0 ? toCurrency(liabVal) : '0';
                
                liabHTML += `<tr><td>${displayName}</td><td>${liabStr}</td><td>${cfStr}</td></tr>`;
                
                // 返済可能なのは liability(残高) があるものだけにする
                if (liabVal > 0) {
                    optionsHTML += `<option value="${item.id}">【返済】${displayName} (残高: $${liabStr})</option>`;
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
