// index.js
import { roomId, SUPABASE_URL, SUPABASE_KEY } from './common_config.js';
import { DOM_SELECTORS } from './common_dom_selectors.js';
import { setButtonActive, setMultipleButtonsActive, BOARD_CELL_NAMES, waitForSupabase } from './common_utils.js';

let supabase = null;

const SEL_G = DOM_SELECTORS.GUEST;
const sectionLogin = document.getElementById(SEL_G.LOGIN.SECTION);
const sectionGuest = document.getElementById(SEL_G.STATUS.SECTION);
const inputUsername = document.getElementById(SEL_G.LOGIN.INPUT_USERNAME);
const btnLogin = document.getElementById(SEL_G.LOGIN.BTN_LOGIN);

const diceStatusArea = document.getElementById(SEL_G.CONTROLS.STATUS_AREA);
const guestDiceResult = document.getElementById(SEL_G.CONTROLS.DICE_RESULT);
const btnRollDice = document.getElementById(SEL_G.CONTROLS.BTN_ROLL_DICE);
const btnClaimPaycheck = document.getElementById(SEL_G.CONTROLS.BTN_CLAIM_PAYCHECK);
const btnEndTurn = document.getElementById(SEL_G.CONTROLS.BTN_END_TURN);
const btnEscapeRatRace = document.getElementById(SEL_G.CONTROLS.BTN_ESCAPE_RAT_RACE);

/* [機能キャンセルアウト] その他のUI要素取得
const elCardLegend = document.getElementById(SEL_G.CARD.LEGEND);
const elStatusMsg = document.getElementById(SEL_G.CARD.STATUS_MESSAGE);
const elNumContainer = document.getElementById(SEL_G.CARD.NUMERICAL_DETAILS_CONTAINER);

const btnDrawSmallDeal = document.getElementById(SEL_G.CARD.BTN_DRAW_SMALL_DEAL);
const btnDrawBigDeal = document.getElementById(SEL_G.CARD.BTN_DRAW_BIG_DEAL);
const btnDrawMarket = document.getElementById(SEL_G.CARD.BTN_DRAW_MARKET);
const btnDrawDoodad = document.getElementById(SEL_G.CARD.BTN_DRAW_DOODAD);

const btnBuyRealEstate = document.getElementById(SEL_G.CARD.BTN_BUY_REALESTATE);
const btnBuyStock = document.getElementById(SEL_G.CARD.BTN_BUY_STOCK);
const btnSellStock = document.getElementById(SEL_G.CARD.BTN_SELL_STOCK);
const btnPayDoodad = document.getElementById(SEL_G.CARD.BTN_PAY_DOODAD);
const btnCardPass = document.getElementById(SEL_G.CARD.BTN_PASS);

const calcPhaseName = document.getElementById(SEL_G.FINANCIALS.CALC_PHASE_NAME);
const calcLockStatus = document.getElementById(SEL_G.FINANCIALS.CALC_LOCK_STATUS);
const displaySalary = document.getElementById(SEL_G.FINANCIALS.DISPLAY_SALARY);
const displayPassiveIncome = document.getElementById(SEL_G.FINANCIALS.DISPLAY_PASSIVE_INCOME);
const displayTotalIncome = document.getElementById(SEL_G.FINANCIALS.DISPLAY_TOTAL_INCOME);
const displayTotalExpenses = document.getElementById(SEL_G.FINANCIALS.DISPLAY_TOTAL_EXPENSES);
const displayMonthlyCashflow = document.getElementById(SEL_G.FINANCIALS.DISPLAY_MONTHLY_CASHFLOW);
const inputTotalIncome = document.getElementById(SEL_G.FINANCIALS.INPUT_TOTAL_INCOME);
const inputNetCashflow = document.getElementById(SEL_G.FINANCIALS.INPUT_NET_CASHFLOW);
const btnCheckCalculations = document.getElementById(SEL_G.FINANCIALS.BTN_CHECK_CALCULATIONS);

const btnBorrowLoan = document.getElementById(SEL_G.PORTFOLIO.BTN_BORROW_LOAN);
const btnPaybackLoan = document.getElementById(SEL_G.PORTFOLIO.BTN_PAYBACK_LOAN);
*/

let currentUserId = null;
let cachedParticipants = [];
let cachedRoom = null;
let clientPendingSalary = 0;

(async function init() {
    const supabaseGlobal = await waitForSupabase();
    supabase = supabaseGlobal.createClient(SUPABASE_URL, SUPABASE_KEY);

    currentUserId = localStorage.getItem('user_id');
    const storedName = localStorage.getItem('player_name');
    
    if (document.getElementById(SEL_G.DEBUG.STORAGE_ID)) {
        document.getElementById(SEL_G.DEBUG.STORAGE_ID).textContent = currentUserId || "未定義";
        document.getElementById(SEL_G.DEBUG.STORAGE_NAME).textContent = storedName || "未定義";
    }
    if (document.getElementById(SEL_G.STATUS.ROOM_ID)) {
        document.getElementById(SEL_G.STATUS.ROOM_ID).textContent = roomId;
    }

    if (currentUserId) {
        const { data } = await supabase.from('participants').select('*').eq('room_id', roomId).eq('user_id', currentUserId).maybeSingle();
        if (data) {
            sectionLogin.hidden = true;
            sectionGuest.hidden = false;
            startSubscriptions();
            return;
        }
    }
    sectionLogin.hidden = false;
    sectionGuest.hidden = true;
})();

btnLogin.addEventListener('click', async (event) => {
    const debugFunctionName = event.currentTarget.id;
    console.log("【デバッグ1】", debugFunctionName);

    console.log("【デバッグ2】supabaseの状態:", supabase);

    if (!supabase) return;
    const username = inputUsername.value.trim();
    if (!username) { alert('名前を入力してください！'); return; }

    const { data: roomCheck } = await supabase.from('rooms').select('game_state').eq('id', roomId).maybeSingle();
    if (roomCheck?.game_state?.status && roomCheck.game_state.status !== 'waiting') {
        alert('ゲームが既に開始されているか終了しているため、入室できません。');
        return;
    }
    console.log("【デバッグ3】", debugFunctionName);

    currentUserId = localStorage.getItem('user_id') || 'user_' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem('user_id', currentUserId);
    localStorage.setItem('player_name', username);

    console.log("【デバッグ4】", debugFunctionName);
    
    const initialRegistrationState = {
        name: username,
        role: "general",
        profession: "未定",
        game_phase: "rat_race",
        position: 0,
        last_dice: 0,
        is_calculating: false,
        calculation_phase: "none",
        children_count: 0,
        charity_turns_left: 0,
        downsized_turns_left: 0,
        financials: {
            cash: 0, total_income: 0, total_expenses: 0, passive_income: 0, net_cash_flow: 0,
            expenses: { taxes: 0, mortgage_payment: 0, car_loan_payment: 0, loan_interest: 0, child_expense: 0, other: 0 },
            assets: { stocks: {}, real_estate: [] },
            liabilities: { mortgage: 0, car_loan: 0, retail_debt: 0, bank_loan: 0 }
        }
    };

    console.log("【デバッグ5】", debugFunctionName);
    
    btnLogin.disabled = true;
    const { error } = await supabase.from('participants').insert(
        [{ room_id: roomId, user_id: currentUserId, state: initialRegistrationState }]
    );
    if (error) {
        alert('送信に失敗しました。');
        btnLogin.disabled = false;
        return;
    }
    sectionLogin.hidden = true;
    sectionGuest.hidden = false;
    startSubscriptions();

    console.log("【デバッグ】5", debugFunctionName);
});

function startSubscriptions() {
    if (!supabase) return;
    supabase.channel('public:participants').on('postgres_changes', {
        event: '*', schema: 'public', table: 'participants' }, async (payload) => {
        if (payload.eventType === 'DELETE') {
            const { data } = await supabase.from('participants').select('id').eq('room_id', roomId);
            if (!data || data.length === 0) {
                localStorage.clear();
                window.location.reload();
                return;
            }
        }
        fetchAndRender();
    }).subscribe();

    supabase.channel('public:rooms').on('postgres_changes', { 
        event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, () => {
        fetchAndRender();
    }).subscribe();

    fetchAndRender();
}

async function fetchAndRender() {
    if (!supabase) return;
    const [resPart, resRoom] = await Promise.all([
        supabase.from('participants').select('*').eq('room_id', roomId).order('id', { ascending: true }),
        supabase.from('rooms').select('*').eq('id', roomId).maybeSingle()
    ]);
    if (resPart.data) cachedParticipants = resPart.data;
    if (resRoom.data) cachedRoom = resRoom.data;
    syncInterface();
}

function syncInterface() {
    const record = cachedParticipants.find(p => p.user_id === currentUserId);
    if (!record || !record.state) return;

    const state = record.state;
    const financials = state.financials || {};
    const turnUserId = cachedRoom ? cachedRoom.current_turn_user_id : null;
    const isMyTurn = (turnUserId === currentUserId);
    // const isLocked = state.is_calculating ?? false; // 検証のためロック無効化
    const isPlaying = cachedRoom?.game_state?.status === 'playing';

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

    // 最小限のサイコロ・手番進行制御・計算ボタン無効化
    if (!isPlaying) {
        diceStatusArea.textContent = "ホストがゲームを開始するまでお待ちください。";
        setButtonActive(SEL_G.CONTROLS.BTN_ROLL_DICE, false);
        setButtonActive(SEL_G.CONTROLS.BTN_CLAIM_PAYCHECK, false);
        setButtonActive(SEL_G.CONTROLS.BTN_END_TURN, false);
        setButtonActive(SEL_G.CONTROLS.BTN_ESCAPE_RAT_RACE, false);
        setButtonActive(SEL_G.FINANCIALS.BTN_CHECK_CALCULATIONS, false); // 実装前のため非アクティブ
    } else {
        const turnUser = cachedParticipants.find(p => p.user_id === turnUserId);
        const turnUserName = turnUser ? turnUser.state.name : "他のプレイヤー";

        if (isMyTurn) {
            if (state.last_dice > 0) {
                setButtonActive(SEL_G.CONTROLS.BTN_ROLL_DICE, false);
                setButtonActive(SEL_G.CONTROLS.BTN_END_TURN, true);
                diceStatusArea.textContent = `結果:【${state.last_dice}】`;
                setButtonActive(SEL_G.CONTROLS.BTN_CLAIM_PAYCHECK, false);
            } else {
                diceStatusArea.textContent = "あなたの手番";
                setButtonActive(SEL_G.CONTROLS.BTN_ROLL_DICE, true);
                setButtonActive(SEL_G.CONTROLS.BTN_CLAIM_PAYCHECK, false);
                setButtonActive(SEL_G.CONTROLS.BTN_END_TURN, false);
            }
            setButtonActive(SEL_G.CONTROLS.BTN_ESCAPE_RAT_RACE, false);
            setButtonActive(SEL_G.FINANCIALS.BTN_CHECK_CALCULATIONS, false); // 実装前のため非アクティブ
        } else {
            diceStatusArea.textContent = `[${turnUserName}] がプレイ中`;
            setButtonActive(SEL_G.CONTROLS.BTN_ROLL_DICE, false);
            setButtonActive(SEL_G.CONTROLS.BTN_CLAIM_PAYCHECK, false);
            setButtonActive(SEL_G.CONTROLS.BTN_END_TURN, false);
            setButtonActive(SEL_G.CONTROLS.BTN_ESCAPE_RAT_RACE, false);
            setButtonActive(SEL_G.FINANCIALS.BTN_CHECK_CALCULATIONS, false); // 実装前のため非アクティブ
        }
    }

    // 現在位置の表示更新
    if (guestDiceResult && state.position !== undefined) {
        const posNum = state.position;
        const posStr = String(posNum).padStart(2, '0'); // "08" のように2桁ゼロ埋め
        const cellName = BOARD_CELL_NAMES[posNum] || "";
        guestDiceResult.textContent = `現在地：${posStr}${cellName}`;
    }

    /* [機能キャンセルアウト] 以下のUI同期処理を全無効化
    if (elCardLegend) { ... }
    if (!currentCard || currentCard.status === "completed") { ... } else { ... }
    if (btnDrawSmallDeal && btnDrawBigDeal && btnDrawMarket && btnDrawDoodad) { ... }
    calcPhaseName.textContent = ...
    displaySalary.textContent = ...
    */
}

btnRollDice.addEventListener('click', async (event) => {
    const debugFunctionName = event.currentTarget.id;
    console.log("【デバッグ】", debugFunctionName);

    if (!supabase) return;
    const diceRoll = Math.floor(Math.random() * 6) + 1;
    const record = cachedParticipants.find(p => p.user_id === currentUserId);
    const oldPos = record?.state?.position ?? 0;
    const newPos = (oldPos + diceRoll) % 24;

    const patch = { position: newPos, last_dice: diceRoll };
    
    /* [機能キャンセルアウト] 財務マス判定と給料日判定
    const FINANCIAL_CELLS = [1, 2, 4, 6, 7, 8, 9, 10, 12, 13, 14, 15, 17, 19, 21, 22, 23];
    if (FINANCIAL_CELLS.includes(newPos)) { ... }
    const PAYDAY_CELLS = [0, 5, 11, 18];
    ...
    */

    await supabase.rpc('merge_participant_state', { target_user_id: currentUserId, state_patch: patch });
});

btnEndTurn.addEventListener('click', async (event) => {
    const debugFunctionName = event.currentTarget.id;
    console.log("【デバッグ】", debugFunctionName);

    if (!supabase) return;

    // 手番終了時に自身のアクションボタンを全て非アクティブ（X）にする
    disableAllActionButtons();

    clientPendingSalary = 0;
    await supabase.rpc('pass_and_end_turn', { p_room_id: roomId, p_user_id: currentUserId });
});

/**
 * ゲスト画面のすべてのアクションボタンを一括で無効化する
 */
function disableAllActionButtons() {
    const { CONTROLS, CARD, PORTFOLIO, FINANCIALS } = DOM_SELECTORS.GUEST;
    const actionButtonIds = [
        CONTROLS.BTN_ROLL_DICE, CONTROLS.BTN_CLAIM_PAYCHECK, CONTROLS.BTN_END_TURN, CONTROLS.BTN_ESCAPE_RAT_RACE,
        CARD.BTN_DRAW_SMALL_DEAL, CARD.BTN_DRAW_BIG_DEAL, CARD.BTN_DRAW_MARKET, CARD.BTN_DRAW_DOODAD,
        CARD.BTN_BUY_REALESTATE, CARD.BTN_BUY_STOCK, CARD.BTN_SELL_STOCK, CARD.BTN_PAY_DOODAD, CARD.BTN_PASS,
        PORTFOLIO.BTN_BORROW_LOAN, PORTFOLIO.BTN_PAYBACK_LOAN,
        FINANCIALS.BTN_CHECK_CALCULATIONS // 未実装機能だが全て無効化の対象に含める
    ];
    setMultipleButtonsActive(actionButtonIds, false);
}

/* [機能キャンセルアウト] その他のボタン処理
btnClaimPaycheck.addEventListener('click', async () => { ... });
btnEscapeRatRace.addEventListener('click', async () => { ... });
const bindDeckDraw = (btn, type) => { ... };
bindDeckDraw(...);
const bindCardDecision = (btn, action) => { ... };
bindCardDecision(...);
const triggerLoanRPC = async (type) => { ... };
btnBorrowLoan.addEventListener('click', () => triggerLoanRPC('borrow'));
btnPaybackLoan.addEventListener('click', () => triggerLoanRPC('payback'));
btnCheckCalculations.onclick = async () => { ... };
*/
