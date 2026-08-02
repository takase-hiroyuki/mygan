// index_ui.js
import { SEL_G } from './common_dom_selectors.js'; 
import { setButtonActive,
        setMultipleButtonsActive,
        BOARD_CELL_NAMES,
        insertSystemMessage } from './common_utils.js'; 
import { updateCardPhaseUI } from './index_ui_cards_ui.js'; 

const sectionLogin = document.getElementById(SEL_G.LOGIN.SECTION);
const sectionGuest = document.getElementById(SEL_G.STATUS.SECTION);
const diceStatusArea = document.getElementById(SEL_G.CONTROLS.STATUS_AREA);
const guestDiceResult = document.getElementById(SEL_G.CONTROLS.DICE_RESULT);

let previousTurnUserId = null;

export function toggleScreen(isLoggedIn) {
    if (sectionLogin) sectionLogin.hidden = isLoggedIn;
    if (sectionGuest) sectionGuest.hidden = !isLoggedIn;
}

function toCurrency(value) {
    return Number(value || 0).toLocaleString();
}

export async function renderGuestUI(currentUserId, cachedParticipants, cachedRoom, supabaseInstance = null) {
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
        
        const client = supabaseInstance || window.supabaseClient || window.supabase;
        if (client) {
            await insertSystemMessage(client, targetName, `${targetName} はサイコロを振って下さい`);
        }
        previousTurnUserId = turnUserId;
    }

    const safeUpdate = (selectorId, text) => {
        if (selectorId) {
            const el = document.getElementById(selectorId);
            if (el) el.textContent = text;
        }
    };

    safeUpdate(SEL_G.STATUS.NAME, state.name || "");
    safeUpdate(SEL_G.STATUS.DISPLAY_CURRENT_CASH, toCurrency(financials.cash));
    safeUpdate(SEL_G.STATUS.PROFESSION, state.profession || "未定");
    safeUpdate(SEL_G.STATUS.ROLE, state.role || "general");
    
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
                badge.style = "display:inline-block; background-color:#ffc107; color:#000;";
                badge.textContent = p.state.name;
                cell.appendChild(badge);
            }
        }
    });

    if (Object.keys(financials).length > 0) {
        const liab = financials.liabilities || {};
        const exp = financials.expenses || {};
        const calcPhaseMsg = flags.is_calculating ? "計算せよ" : "計算不要";

        safeUpdate(SEL_G.FINANCIALS.CALC_LOCK_STATUS, calcPhaseMsg);
        safeUpdate(SEL_G.FINANCIALS.DISPLAY_SALARY, toCurrency(financials.salary));
        safeUpdate(SEL_G.FINANCIALS.DISPLAY_PASSIVE_INCOME, toCurrency(financials.passive_income));
        safeUpdate(SEL_G.FINANCIALS.DISPLAY_TOTAL_INCOME, toCurrency(financials.total_income));
        safeUpdate(SEL_G.FINANCIALS.DISPLAY_TOTAL_EXPENSES, toCurrency(financials.total_expenses));
        safeUpdate(SEL_G.FINANCIALS.DISPLAY_MONTHLY_CASHFLOW, toCurrency(financials.net_cash_flow));
        safeUpdate(SEL_G.PORTFOLIO.LIABILITY_MORTGAGE, toCurrency(liab.mortgage));
        safeUpdate(SEL_G.PORTFOLIO.LIABILITY_CAR_LOAN, toCurrency(liab.car_loans)); 
        safeUpdate(SEL_G.PORTFOLIO.LIABILITY_RETAIL, toCurrency(liab.retail_debt)); 
        safeUpdate(SEL_G.PORTFOLIO.DISPLAY_LIABILITY_BANKLOAN, toCurrency(liab.bank_loan));        
        safeUpdate(SEL_G.PORTFOLIO.LIABILITY_SCHOOL_LOAN, toCurrency(liab.school_loans));
        safeUpdate(SEL_G.PORTFOLIO.LIABILITY_CREDIT_CARD, toCurrency(liab.credit_card_debt));
        safeUpdate(SEL_G.PORTFOLIO.DISPLAY_EXPENSE_LOANINTEREST, toCurrency(exp.bank_loan_payment));
        safeUpdate(SEL_G.PORTFOLIO.DISPLAY_EXPENSE_CHILD, toCurrency(exp.child_expense));        
        safeUpdate(SEL_G.PORTFOLIO.DISPLAY_EXPENSE_TAXES, toCurrency(exp.taxes));
        safeUpdate(SEL_G.PORTFOLIO.DISPLAY_EXPENSE_MORTGAGE, toCurrency(exp.mortgage_payment));
        safeUpdate(SEL_G.PORTFOLIO.DISPLAY_EXPENSE_SCHOOL, toCurrency(exp.school_loan_payment));
        safeUpdate(SEL_G.PORTFOLIO.DISPLAY_EXPENSE_CAR, toCurrency(exp.car_loan_payment));
        safeUpdate(SEL_G.PORTFOLIO.DISPLAY_EXPENSE_CREDIT, toCurrency(exp.credit_card_payment));
        safeUpdate(SEL_G.PORTFOLIO.DISPLAY_EXPENSE_RETAIL, toCurrency(exp.retail_payment));
        safeUpdate(SEL_G.PORTFOLIO.DISPLAY_EXPENSE_OTHER, toCurrency(exp.other_expenses));
    }

    if (!isPlaying) {
        if (diceStatusArea) diceStatusArea.textContent = "ホストがゲームを開始するまでお待ちください。";
        disableAllActionButtons();
    } else {
        const turnUser = cachedParticipants.find(p => p.user_id === turnUserId);
        const turnUserName = turnUser ? turnUser.state.name : "他のプレイヤー";        
        const currentCard = cachedRoom?.game_state?.current_card || null;

        if (isMyTurn) {
            if (state.last_dice > 0) {
                updateCardPhaseUI(state.position, flags, currentCard, turnUserName);
                
                const pendingPaydays = parseInt(flags.pending_paydays || 0, 10);
                if (diceStatusArea) {
                    if (pendingPaydays > 0) {
                        diceStatusArea.textContent = `結果:【${state.last_dice}】 入金請求（${pendingPaydays}回分）`;
                    } else {
                        diceStatusArea.textContent = `結果:【${state.last_dice}】`;
                    }
                }
            } else {
                if (diceStatusArea) diceStatusArea.textContent = "あなたの手番";
                
                setMultipleButtonsActive([
                    SEL_G.CARD.BTN_DRAW_SMALL_DEAL, SEL_G.CARD.BTN_DRAW_BIG_DEAL,
                    SEL_G.CARD.BTN_DRAW_MARKET, SEL_G.CARD.BTN_DRAW_DOODAD
                ], false);
            }
            
            setButtonActive(SEL_G.CONTROLS.BTN_ESCAPE_RAT_RACE, false);
            setButtonActive(SEL_G.FINANCIALS.BTN_CHECK_CALCULATIONS, !!flags.is_calculating);
            setButtonActive(SEL_G.PORTFOLIO.BTN_BORROW_LOAN, true);

            const currentCash = parseInt(financials.cash || 0, 10);
            const currentBankLoan = parseInt(financials.liabilities?.bank_loan || 0, 10);
            const canRepay = (currentCash >= 1000) && (currentBankLoan >= 1000);
            setButtonActive(SEL_G.PORTFOLIO.BTN_PAYBACK_LOAN, canRepay);
            
        } else {
            if (diceStatusArea) diceStatusArea.textContent = `[${turnUserName}] がプレイ中`;
            disableAllActionButtons();
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
    const { CONTROLS, CARD, PORTFOLIO, FINANCIALS } = SEL_G; 
    const actionButtonIds = [
        CONTROLS.BTN_ROLL_DICE,
        CONTROLS.BTN_ROLL_DICE_2,
        CONTROLS.BTN_CLAIM_PAYCHECK, 
        CONTROLS.BTN_END_TURN,
        CONTROLS.BTN_ESCAPE_RAT_RACE,
        CARD.BTN_DRAW_SMALL_DEAL,
        CARD.BTN_DRAW_BIG_DEAL,
        CARD.BTN_DRAW_MARKET,
        CARD.BTN_DRAW_DOODAD,
        CARD.BTN_BUY_REALESTATE,
        CARD.BTN_BUY_STOCK,
        CARD.BTN_SELL_STOCK,
        CARD.BTN_PASS,
        CARD.BTN_EXECUTE_PAYMENT, 
        PORTFOLIO.BTN_BORROW_LOAN,
        PORTFOLIO.BTN_PAYBACK_LOAN, 
        FINANCIALS.BTN_CHECK_CALCULATIONS
    ];
    setMultipleButtonsActive(actionButtonIds, false);
}

console.log("【デバッグ】index_ui.js が読み込まれました。");
