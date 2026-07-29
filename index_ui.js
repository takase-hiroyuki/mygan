// index_ui.js
import { DOM_SELECTORS } from './common_dom_selectors.js';
import { setButtonActive, setMultipleButtonsActive, BOARD_CELL_NAMES } from './common_utils.js';
import { updateCardPhaseUI } from './index_ui_cards.js'; 

const SEL_G = DOM_SELECTORS.GUEST;
const sectionLogin = document.getElementById(SEL_G.LOGIN.SECTION);
const sectionGuest = document.getElementById(SEL_G.STATUS.SECTION);
const diceStatusArea = document.getElementById(SEL_G.CONTROLS.STATUS_AREA);
const guestDiceResult = document.getElementById(SEL_G.CONTROLS.DICE_RESULT);

/**
 * ログイン画面とゲスト画面の切り替え
 */
export function toggleScreen(isLoggedIn) {
    sectionLogin.hidden = isLoggedIn;
    sectionGuest.hidden = !isLoggedIn;
}

/**
 * 通貨フォーマット用ヘルパー関数
 */
function toCurrency(value) {
    return `$${Number(value || 0).toLocaleString()}`;
}

/**
 * ゲスト画面全体の描画更新（純粋なView関数）
 */
export function renderGuestUI(currentUserId, cachedParticipants, cachedRoom) {
    const record = cachedParticipants.find(p => p.user_id === currentUserId);
    if (!record || !record.state) return;

    const state = record.state;
    const financials = state.financials || {};
    const flags = state.flags || {}; 
    const turnUserId = cachedRoom ? cachedRoom.current_turn_user_id : null;
    const isMyTurn = (turnUserId === currentUserId);
    const isPlaying = cachedRoom?.game_state?.status === 'playing';

    // 1. プレイヤー情報の表示
    document.getElementById(SEL_G.STATUS.NAME).textContent = state.name || "";
    document.getElementById(SEL_G.STATUS.DISPLAY_CURRENT_CASH).textContent = toCurrency(financials.cash);
    document.getElementById(SEL_G.STATUS.PROFESSION).textContent = state.profession || "未定";
    document.getElementById(SEL_G.STATUS.ROLE).textContent = state.role || "general";

    // 2. 盤面描画
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

    // 3. 財務諸表・資産負債状況の描画更新（★追加部分）
    if (Object.keys(financials).length > 0) {
        const safeUpdate = (selectorId, text) => {
            if (selectorId) {
                const el = document.getElementById(selectorId);
                if (el) el.textContent = text;
            }
        };

        const liab = financials.liabilities || {};
        const exp = financials.expenses || {};

        // ステータスメッセージの更新（「データを読み込み中...」を上書き）
        const calcPhaseMsg = flags.is_calculating ? "財務計算入力（筆算フェーズ）" : "待機中";
        safeUpdate(SEL_G.FINANCIALS?.STATUS_MESSAGE, `現在の状態: ${calcPhaseMsg}`);

        // 財務諸表 (Income & Expenses)
        safeUpdate(SEL_G.FINANCIALS?.DISPLAY_SALARY, toCurrency(financials.salary));
        safeUpdate(SEL_G.FINANCIALS?.DISPLAY_PASSIVE_INCOME, toCurrency(financials.passive_income));
        safeUpdate(SEL_G.FINANCIALS?.DISPLAY_TOTAL_INCOME, toCurrency(financials.total_income));
        safeUpdate(SEL_G.FINANCIALS?.DISPLAY_TOTAL_EXPENSES, toCurrency(financials.total_expenses));
        safeUpdate(SEL_G.FINANCIALS?.DISPLAY_PAYDAY, toCurrency(financials.net_cash_flow));

        // 負債状況 (Liabilities)
        safeUpdate(SEL_G.PORTFOLIO?.DISPLAY_MORTGAGE, toCurrency(liab.mortgage));
        safeUpdate(SEL_G.PORTFOLIO?.DISPLAY_CAR_LOAN, toCurrency(liab.car_loan));
        safeUpdate(SEL_G.PORTFOLIO?.DISPLAY_RETAIL_DEBT, toCurrency(liab.retail_debt));
        safeUpdate(SEL_G.PORTFOLIO?.DISPLAY_BANK_LOAN, toCurrency(liab.bank_loan));
        
        // ローン利息支出
        safeUpdate(SEL_G.PORTFOLIO?.DISPLAY_BANK_LOAN_PAYMENT, toCurrency(exp.bank_loan_payment));
    }

    // 4. ボタン・ステータス制御
    if (!isPlaying) {
        diceStatusArea.textContent = "ホストがゲームを開始するまでお待ちください。";
        disableAllActionButtons();
    } else {
        const turnUser = cachedParticipants.find(p => p.user_id === turnUserId);
        const turnUserName = turnUser ? turnUser.state.name : "他のプレイヤー";

        if (isMyTurn) {
            if (state.last_dice > 0) {
                setButtonActive(SEL_G.CONTROLS.BTN_ROLL_DICE, false);
                setButtonActive(SEL_G.CONTROLS.BTN_END_TURN, true);
                
                updateCardPhaseUI(state.position, flags);
                
                // Paydayフェーズに応じたUIの切り替え
                if (state.calculation_phase === 'payday') {
                    diceStatusArea.textContent = `結果:【${state.last_dice}】 Paycheck請求可能`;
                    setButtonActive(SEL_G.CONTROLS.BTN_CLAIM_PAYCHECK, true);
                } else {
                    diceStatusArea.textContent = `結果:【${state.last_dice}】`;
                    setButtonActive(SEL_G.CONTROLS.BTN_CLAIM_PAYCHECK, false);
                }
            } else {
                diceStatusArea.textContent = "あなたの手番";
                setButtonActive(SEL_G.CONTROLS.BTN_ROLL_DICE, true);
                setButtonActive(SEL_G.CONTROLS.BTN_CLAIM_PAYCHECK, false);
                setButtonActive(SEL_G.CONTROLS.BTN_END_TURN, false);
                
                // 手番開始時にローン操作を可能にする
                setButtonActive(SEL_G.PORTFOLIO.BTN_BORROW_LOAN, true);
                setButtonActive(SEL_G.PORTFOLIO.BTN_PAYBACK_LOAN, true);
                
                // サイコロを振る前はカードボタンを無効化
                setMultipleButtonsActive([
                    SEL_G.CARD.BTN_DRAW_SMALL_DEAL, SEL_G.CARD.BTN_DRAW_BIG_DEAL,
                    SEL_G.CARD.BTN_DRAW_MARKET, SEL_G.CARD.BTN_DRAW_DOODAD
                ], false);
                const statusMessage = document.getElementById(SEL_G.CARD.STATUS_MESSAGE);
                if (statusMessage) statusMessage.textContent = "サイコロを振って移動してください。";
            }
            setButtonActive(SEL_G.CONTROLS.BTN_ESCAPE_RAT_RACE, false);
            setButtonActive(SEL_G.FINANCIALS.BTN_CHECK_CALCULATIONS, false);
        } else {
            diceStatusArea.textContent = `[${turnUserName}] がプレイ中`;
            disableAllActionButtons();
            
            // 自分の手番ではない場合、カード状況テキストをリセットする
            const statusMessage = document.getElementById(SEL_G.CARD.STATUS_MESSAGE);
            if (statusMessage) {
                statusMessage.textContent = "他のプレイヤーの行動を待っています。";
            }
        }
    }

    // 5. 現在位置の表示更新
    if (guestDiceResult && state.position !== undefined) {
        const posNum = state.position;
        const posStr = String(posNum).padStart(2, '0');
        const cellName = BOARD_CELL_NAMES[posNum] || "";
        guestDiceResult.textContent = `現在地：${posStr}${cellName}`;
    }
}

/**
 * ゲスト画面のすべてのアクションボタンを一括で無効化する
 */
export function disableAllActionButtons() {
    const { CONTROLS, CARD, PORTFOLIO, FINANCIALS } = DOM_SELECTORS.GUEST;
    const actionButtonIds = [
        CONTROLS.BTN_ROLL_DICE, CONTROLS.BTN_CLAIM_PAYCHECK, CONTROLS.BTN_END_TURN, CONTROLS.BTN_ESCAPE_RAT_RACE,
        CARD.BTN_DRAW_SMALL_DEAL, CARD.BTN_DRAW_BIG_DEAL, CARD.BTN_DRAW_MARKET, CARD.BTN_DRAW_DOODAD,
        CARD.BTN_BUY_REALESTATE, CARD.BTN_BUY_STOCK, CARD.BTN_SELL_STOCK, CARD.BTN_PAY_DOODAD, CARD.BTN_PASS,
        PORTFOLIO.BTN_BORROW_LOAN, PORTFOLIO.BTN_PAYBACK_LOAN,
        FINANCIALS.BTN_CHECK_CALCULATIONS
    ];
    setMultipleButtonsActive(actionButtonIds, false);
}

console.log("【デバッグ】index_ui.js が読み込まれました。");
