// index_ui.js
import { DOM_SELECTORS } from './common_dom_selectors.js';
import { setButtonActive, setMultipleButtonsActive, BOARD_CELL_NAMES } from './common_utils.js';

const SEL_G = DOM_SELECTORS.GUEST;
const sectionLogin = document.getElementById(SEL_G.LOGIN.SECTION);
const sectionGuest = document.getElementById(SEL_G.STATUS.SECTION);
const diceStatusArea = document.getElementById(SEL_G.CONTROLS.STATUS_AREA);
const guestDiceResult = document.getElementById(SEL_G.CONTROLS.DICE_RESULT);

// ==========================================
// 1. マスの種類ごとのインデックス定義
// ==========================================
const CELLS_OPPORTUNITY = [2, 4, 6, 8, 10, 13, 15, 17, 19, 21, 23];
const CELLS_DOODAD = [1, 7, 14];
const CELLS_MARKET = [12, 22];

/**
 * ログイン画面とゲスト画面の切り替え
 */
export function toggleScreen(isLoggedIn) {
    sectionLogin.hidden = isLoggedIn;
    sectionGuest.hidden = !isLoggedIn;
}

/**
 * 現在地に応じてUIを切り替える関数（ドローボタンの制御）
 */
function updateCardPhaseUI(position) {
    // まず全てのドローボタンとアクションボタンを非アクティブ（無効）にする
    const drawButtons = [
        SEL_G.CARD.BTN_DRAW_SMALL_DEAL,
        SEL_G.CARD.BTN_DRAW_BIG_DEAL,
        SEL_G.CARD.BTN_DRAW_MARKET,
        SEL_G.CARD.BTN_DRAW_DOODAD
    ];
    const actionButtons = [
        SEL_G.CARD.BTN_BUY_REALESTATE,
        SEL_G.CARD.BTN_BUY_STOCK,
        SEL_G.CARD.BTN_SELL_STOCK,
        SEL_G.CARD.BTN_PAY_DOODAD,
        SEL_G.CARD.BTN_PASS
    ];
    
    setMultipleButtonsActive(drawButtons, false);
    setMultipleButtonsActive(actionButtons, false);

    const statusMessage = document.getElementById(SEL_G.CARD.STATUS_MESSAGE);
    if (statusMessage) statusMessage.textContent = "現在場に出ているカードはありません。";

    // 現在地（position）のマス属性に応じて、該当するドローボタンだけを有効にする
    if (CELLS_OPPORTUNITY.includes(position)) {
        setButtonActive(SEL_G.CARD.BTN_DRAW_SMALL_DEAL, true);
        setButtonActive(SEL_G.CARD.BTN_DRAW_BIG_DEAL, true);
    } else if (CELLS_MARKET.includes(position)) {
        setButtonActive(SEL_G.CARD.BTN_DRAW_MARKET, true);
    } else if (CELLS_DOODAD.includes(position)) {
        setButtonActive(SEL_G.CARD.BTN_DRAW_DOODAD, true);
    }
}

/**
 * ゲスト画面全体の描画更新（純粋なView関数）
 */
export function renderGuestUI(currentUserId, cachedParticipants, cachedRoom) {
    const record = cachedParticipants.find(p => p.user_id === currentUserId);
    if (!record || !record.state) return;

    const state = record.state;
    const financials = state.financials || {};
    const turnUserId = cachedRoom ? cachedRoom.current_turn_user_id : null;
    const isMyTurn = (turnUserId === currentUserId);
    const isPlaying = cachedRoom?.game_state?.status === 'playing';

    // プレイヤー情報の表示
    document.getElementById(SEL_G.STATUS.NAME).textContent = state.name || "";
    document.getElementById(SEL_G.STATUS.DISPLAY_CURRENT_CASH).textContent = (financials.cash ?? 0).toLocaleString();
    document.getElementById(SEL_G.STATUS.PROFESSION).textContent = state.profession || "未定";
    document.getElementById(SEL_G.STATUS.ROLE).textContent = state.role || "general";

    // 盤面描画
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

    // ボタン・ステータス制御
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
                
                // サイコロを振った後はカードのUIを更新
                updateCardPhaseUI(state.position);
                
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
        }
    }

    // 現在位置の表示更新
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

// ==========================================
// ドローボタン押下時のダミー動作（UI遷移のみ）
// ==========================================
document.getElementById(SEL_G.CARD.BTN_DRAW_SMALL_DEAL)?.addEventListener('click', () => {
    setButtonActive(SEL_G.CARD.BTN_DRAW_SMALL_DEAL, false);
    setButtonActive(SEL_G.CARD.BTN_DRAW_BIG_DEAL, false);
    
    setButtonActive(SEL_G.CARD.BTN_BUY_STOCK, true);
    setButtonActive(SEL_G.CARD.BTN_BUY_REALESTATE, true);
    setButtonActive(SEL_G.CARD.BTN_PASS, true);
    
    const msg = document.getElementById(SEL_G.CARD.STATUS_MESSAGE);
    if (msg) msg.textContent = "【UIテスト】Small Dealを引きました。アクションを選択してください。";
});

document.getElementById(SEL_G.CARD.BTN_DRAW_BIG_DEAL)?.addEventListener('click', () => {
    setButtonActive(SEL_G.CARD.BTN_DRAW_SMALL_DEAL, false);
    setButtonActive(SEL_G.CARD.BTN_DRAW_BIG_DEAL, false);
    
    setButtonActive(SEL_G.CARD.BTN_BUY_REALESTATE, true);
    setButtonActive(SEL_G.CARD.BTN_PASS, true);
    
    const msg = document.getElementById(SEL_G.CARD.STATUS_MESSAGE);
    if (msg) msg.textContent = "【UIテスト】Big Dealを引きました。アクションを選択してください。";
});

document.getElementById(SEL_G.CARD.BTN_DRAW_MARKET)?.addEventListener('click', () => {
    setButtonActive(SEL_G.CARD.BTN_DRAW_MARKET, false);
    
    setButtonActive(SEL_G.CARD.BTN_SELL_STOCK, true);
    setButtonActive(SEL_G.CARD.BTN_PASS, true);
    
    const msg = document.getElementById(SEL_G.CARD.STATUS_MESSAGE);
    if (msg) msg.textContent = "【UIテスト】Marketを引きました。アクションを選択してください。";
});

document.getElementById(SEL_G.CARD.BTN_DRAW_DOODAD)?.addEventListener('click', () => {
    setButtonActive(SEL_G.CARD.BTN_DRAW_DOODAD, false);
    
    setButtonActive(SEL_G.CARD.BTN_PAY_DOODAD, true);
    
    const msg = document.getElementById(SEL_G.CARD.STATUS_MESSAGE);
    if (msg) msg.textContent = "【UIテスト】Doodadを引きました。費用を支払ってください。";
});

console.log("【デバッグ】index_ui.js が読み込まれました。");
