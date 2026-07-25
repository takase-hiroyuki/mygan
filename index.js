// index.js

import { roomId, SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { DOM_SELECTORS } from './dom_selectors.js';

// HTML側でロード済みのグローバルな supabase インスタンスからクライアントを生成
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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

let currentUserId = null;
let cachedParticipants = [];
let cachedRoom = null;
let clientPendingSalary = 0;

(async function init() {
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

btnLogin.addEventListener('click', async () => {
    const username = inputUsername.value.trim();
    if (!username) { alert('名前を入力してください！'); return; }

    const { data: roomCheck } = await supabase.from('rooms').select('game_state').eq('id', roomId).maybeSingle();
    if (roomCheck?.game_state?.status && roomCheck.game_state.status !== 'waiting') {
        alert('ゲームが既に開始されているか終了しているため、入室できません。');
        return;
    }

    currentUserId = localStorage.getItem('user_id') || 'user_' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem('user_id', currentUserId);
    localStorage.setItem('player_name', username);

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

    btnLogin.disabled = true;
    const { error } = await supabase.from('participants').insert([{ room_id: roomId, user_id: currentUserId, state: initialRegistrationState }]);
    if (error) {
        alert('送信に失敗しました。');
        btnLogin.disabled = false;
        return;
    }
    sectionLogin.hidden = true;
    sectionGuest.hidden = false;
    startSubscriptions();
});

function startSubscriptions() {
    supabase.channel('public:participants').on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, async (payload) => {
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

    supabase.channel('public:rooms').on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, () => {
        fetchAndRender();
    }).subscribe();

    fetchAndRender();
}

async function fetchAndRender() {
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
    const isLocked = state.is_calculating ?? false;
    const currentCard = cachedRoom?.game_state?.current_card || null;
    const isPlaying = cachedRoom?.game_state?.status === 'playing';

    document.getElementById(SEL_G.STATUS.NAME).textContent = state.name || "";
    document.getElementById(SEL_G.STATUS.DISPLAY_CURRENT_CASH).textContent = (financials.cash ?? 0).toLocaleString();
    document.getElementById(SEL_G.STATUS.PROFESSION).textContent = state.profession || "未定";
    document.getElementById(SEL_G.STATUS.ROLE).textContent = state.role || "general";

    for (let i = 0; i < 24; i++) {
        const cell = document.getElementById(`${SEL_G.BOARD.RAT_PREFIX}${i}`);
        if (cell) cell.innerHTML = "";
    }
    cachedParticipants.forEach(p => {
        if (p.state && p.state.position !== undefined) {
            const cell = document.getElementById(`${SEL_G.BOARD.RAT_PREFIX}${parseInt(p.state.position, 10)}`);
            if (cell) {
                const badge = document.createElement('span');
                badge.style = "display:inline-block; background-color:#ffc107; color:#000; padding:2px 6px; margin:0 2px; border-radius:4px; font-size:0.85em; font-weight:bold;";
                badge.textContent = p.state.name;
                cell.appendChild(badge);
            }
        }
    });

    if (!isPlaying) {
        diceStatusArea.textContent = "ホストがゲームを開始するまでお待ちください。";
        btnRollDice.disabled = true; btnRollDice.textContent = "X サイコロを振る";
        btnClaimPaycheck.disabled = true; btnEndTurn.disabled = true; btnEscapeRatRace.disabled = true;
    } else {
        const turnUser = cachedParticipants.find(p => p.user_id === turnUserId);
        const turnUserName = turnUser ? turnUser.state.name : "他のプレイヤー";

        if (isMyTurn) {
            if (isLocked) {
                diceStatusArea.textContent = "【手番】手動計算チェックが完了するまでロックされています。";
                btnRollDice.disabled = true; btnRollDice.textContent = "X サイコロを振る";
                btnClaimPaycheck.disabled = true; btnEndTurn.disabled = true;
            } else if (state.last_dice > 0) {
                btnRollDice.disabled = true; btnRollDice.textContent = "X サイコロを振る";
                btnEndTurn.disabled = false; btnEndTurn.textContent = "O 手番終了";
                if (clientPendingSalary > 0) {
                    diceStatusArea.textContent = `出目: ${state.last_dice}。Paycheckが未請求です！`;
                    btnClaimPaycheck.disabled = false; btnClaimPaycheck.textContent = `O Paycheck請求 (+$${clientPendingSalary})`;
                } else {
                    diceStatusArea.textContent = `出目: ${state.last_dice}。手番を終了できます。`;
                    btnClaimPaycheck.disabled = true; btnClaimPaycheck.textContent = "X Paycheck請求";
                }
            } else {
                diceStatusArea.textContent = "あなたの手番です。サイコロを振ってください。";
                btnRollDice.disabled = false; btnRollDice.textContent = "O サイコロを振る";
                btnClaimPaycheck.disabled = true; btnEndTurn.disabled = true;
            }
            btnEscapeRatRace.disabled = !(financials.passive_income > financials.total_expenses && !isLocked);
            btnEscapeRatRace.textContent = btnEscapeRatRace.disabled ? "X ラットレース脱出" : "O ラットレース脱出";
        } else {
            diceStatusArea.textContent = `現在、[${turnUserName}] がプレイ中です。`;
            btnRollDice.disabled = true; btnRollDice.textContent = "X サイコロを振る";
            btnClaimPaycheck.disabled = true; btnClaimPaycheck.textContent = "X Paycheck請求";
            btnEndTurn.disabled = true; btnEndTurn.textContent = "X 手番終了";
            btnEscapeRatRace.disabled = true; btnEscapeRatRace.textContent = "X ラットレース脱出";
        }
    }

    if (elCardLegend) {
        const turnUser = cachedParticipants.find(p => p.user_id === turnUserId);
        elCardLegend.textContent = turnUser ? `${turnUser.state.name} が引いたカードの内容` : "カード状況";
    }

    if (!currentCard || currentCard.status === "completed") {
        elStatusMsg.textContent = "現在場に出ているカードはありません。";
        if (elNumContainer) elNumContainer.style.display = "none";
        btnBuyRealEstate.disabled = true; btnBuyStock.disabled = true;
        btnSellStock.disabled = true; btnPayDoodad.disabled = true; btnCardPass.disabled = true;
    } else {
        elStatusMsg.textContent = `【${currentCard.title || '無題'}】(${currentCard.deck_type})\n${currentCard.description || ''}`;
        if (currentCard.cost !== undefined || currentCard.down_payment !== undefined || currentCard.passive_income !== undefined) {
            if (elNumContainer) elNumContainer.style.display = "block";
            document.getElementById(SEL_G.CARD.DETAIL_COST).textContent = (currentCard.cost || 0).toLocaleString();
            document.getElementById(SEL_G.CARD.DETAIL_DOWNPAYMENT).textContent = (currentCard.down_payment || 0).toLocaleString();
            document.getElementById(SEL_G.CARD.DETAIL_CASHFLOW).textContent = (currentCard.passive_income || 0).toLocaleString();
        } else {
            if (elNumContainer) elNumContainer.style.display = "none";
        }

        const deckType = currentCard.deck_type;
        if (isMyTurn && !isLocked && state.last_dice > 0 && clientPendingSalary === 0 && currentCard.status === "active") {
            btnBuyRealEstate.disabled = !(deckType === 'big_deal' || deckType === 'small_deal');
            btnBuyStock.disabled = !(deckType === 'big_deal' || deckType === 'small_deal');
            btnSellStock.disabled = !(deckType === 'market');
            btnPayDoodad.disabled = !(deckType === 'doodad');
            btnCardPass.disabled = (deckType === 'doodad');
        } else {
            btnBuyRealEstate.disabled = true; btnBuyStock.disabled = true;
            btnSellStock.disabled = true; btnPayDoodad.disabled = true; btnCardPass.disabled = true;
        }
    }

    if (btnDrawSmallDeal && btnDrawBigDeal && btnDrawMarket && btnDrawDoodad) {
        const pos = state.position ?? 0;
        const lastDice = state.last_dice ?? 0;
        const OPPORTUNITY_CELLS = [2, 4, 6, 8, 10, 13, 15, 17, 19, 21, 23];
        const MARKET_CELLS = [12, 22];
        const DOODAD_CELLS = [1, 7, 14];

        const canDraw = isMyTurn && lastDice > 0 && clientPendingSalary === 0 && (!currentCard || currentCard.status === 'completed');
        btnDrawSmallDeal.disabled = !(canDraw && OPPORTUNITY_CELLS.includes(pos));
        btnDrawBigDeal.disabled = !(canDraw && OPPORTUNITY_CELLS.includes(pos));
        btnDrawMarket.disabled = !(canDraw && MARKET_CELLS.includes(pos));
        btnDrawDoodad.disabled = !(canDraw && DOODAD_CELLS.includes(pos));

        btnDrawSmallDeal.textContent = btnDrawSmallDeal.disabled ? "X Small Dealを引く" : "O Small Dealを引く";
        btnDrawBigDeal.textContent = btnDrawBigDeal.disabled ? "X Big Dealを引く" : "O Big Dealを引く";
        btnDrawMarket.textContent = btnDrawMarket.disabled ? "X Marketを引く" : "O Marketを引く";
        btnDrawDoodad.textContent = btnDrawDoodad.disabled ? "X Doodadを引く" : "O Doodadを引く";
    }

    calcPhaseName.textContent = state.calculation_phase || "none";
    if (isLocked) {
        calcLockStatus.textContent = "計算検証待ち (ロック中)";
        calcLockStatus.style.color = "red";
        inputTotalIncome.disabled = false; inputNetCashflow.disabled = false; btnCheckCalculations.disabled = false;
    } else {
        calcLockStatus.textContent = "計算完了 (解除済み)";
        calcLockStatus.style.color = "green";
        inputTotalIncome.disabled = true; inputNetCashflow.disabled = true; btnCheckCalculations.disabled = true;
        inputTotalIncome.value = ""; inputNetCashflow.value = "";
    }

    displaySalary.textContent = (financials.salary || 0).toLocaleString();
    displayPassiveIncome.textContent = (financials.passive_income || 0).toLocaleString();
    displayTotalIncome.textContent = (financials.total_income || 0).toLocaleString();
    displayTotalExpenses.textContent = (financials.total_expenses || 0).toLocaleString();
    displayMonthlyCashflow.textContent = (financials.net_cash_flow || 0).toLocaleString();

    const liab = financials.liabilities || {};
    const exp = financials.expenses || {};
    document.getElementById(SEL_G.PORTFOLIO.DISPLAY_LIABILITY_MORTGAGE).textContent = (liab.mortgage || 0).toLocaleString();
    document.getElementById(SEL_G.PORTFOLIO.DISPLAY_LIABILITY_CAR_LOAN).textContent = (liab.car_loan || 0).toLocaleString();
    document.getElementById(SEL_G.PORTFOLIO.DISPLAY_LIABILITY_RETAIL).textContent = (liab.retail_debt || 0).toLocaleString();
    
    const bankLoanVal = liab.bank_loan || 0;
    document.getElementById(SEL_G.PORTFOLIO.DISPLAY_LIABILITY_BANKLOAN).textContent = bankLoanVal.toLocaleString();
    document.getElementById(SEL_G.PORTFOLIO.DISPLAY_EXPENSE_LOANINTEREST).textContent = (exp.loan_interest || 0).toLocaleString();

    btnBorrowLoan.disabled = !(isMyTurn && !isLocked);
    btnPaybackLoan.disabled = !(isMyTurn && !isLocked && bankLoanVal >= 1000);
}

btnRollDice.addEventListener('click', async () => {
    const diceRoll = Math.floor(Math.random() * 6) + 1;
    const record = cachedParticipants.find(p => p.user_id === currentUserId);
    const oldPos = record?.state?.position ?? 0;
    const newPos = (oldPos + diceRoll) % 24;

    const patch = { position: newPos, last_dice: diceRoll };
    const FINANCIAL_CELLS = [1, 2, 4, 6, 7, 8, 9, 10, 12, 13, 14, 15, 17, 19, 21, 22, 23];
    if (FINANCIAL_CELLS.includes(newPos)) {
        patch.is_calculating = true;
        patch.calculation_phase = "deal";
    }

    const PAYDAY_CELLS = [0, 5, 11, 18];
    let payCount = 0;
    const diff = (newPos - oldPos + 24) % 24;
    for (let i = 1; i <= diff; i++) {
        if (PAYDAY_CELLS.includes((oldPos + i) % 24)) payCount++;
    }
    if (payCount > 0) {
        clientPendingSalary = payCount * (record?.state?.financials?.net_cash_flow || 0);
    }

    await supabase.rpc('merge_participant_state', { target_user_id: currentUserId, state_patch: patch });
});

btnClaimPaycheck.addEventListener('click', async () => {
    if (clientPendingSalary <= 0) return;
    const record = cachedParticipants.find(p => p.user_id === currentUserId);
    const financials = record.state.financials || {};
    
    const patch = {
        financials: { ...financials, cash: (financials.cash ?? 0) + clientPendingSalary }
    };
    await supabase.rpc('merge_participant_state', { target_user_id: currentUserId, state_patch: patch });
    clientPendingSalary = 0;
});

btnEndTurn.addEventListener('click', async () => {
    clientPendingSalary = 0;
    await supabase.rpc('pass_and_end_turn', { p_room_id: roomId, p_user_id: currentUserId });
});

btnEscapeRatRace.addEventListener('click', async () => {
    const patch = { role: "fast_track", game_phase: "fast_track", position: 0, last_dice: 0 };
    await supabase.rpc('merge_participant_state', { target_user_id: currentUserId, state_patch: patch });
    alert('ラットレースから脱出しました！');
});

const bindDeckDraw = (btn, type) => {
    btn?.addEventListener('click', async () => {
        await supabase.rpc('draw_card_from_deck', { p_room_id: roomId, p_user_id: currentUserId, p_deck_type: type });
    });
};
bindDeckDraw(btnDrawSmallDeal, 'small_deal');
bindDeckDraw(btnDrawBigDeal, 'big_deal');
bindDeckDraw(btnDrawMarket, 'market');
bindDeckDraw(btnDrawDoodad, 'doodad');

const bindCardDecision = (btn, action) => {
    btn?.addEventListener('click', async () => {
        const { error } = await supabase.rpc('process_financial_transaction', { p_room_id: roomId, p_user_id: currentUserId, p_action_type: action });
        if (error) alert(error.message);
    });
};
bindCardDecision(btnBuyRealEstate, 'buy_real_estate');
bindCardDecision(btnBuyStock, 'buy_stock');
bindCardDecision(btnSellStock, 'sell_stock');
bindCardDecision(btnPayDoodad, 'pay_doodad');
bindCardDecision(btnCardPass, 'pass');

const triggerLoanRPC = async (type) => {
    const record = cachedParticipants.find(p => p.user_id === currentUserId);
    const financials = record.state.financials || {};
    let cash = financials.cash ?? 0;
    let liabilities = financials.liabilities || {};
    let bankLoan = liabilities.bank_loan || 0;

    if (type === 'borrow') { bankLoan += 1000; cash += 1000; }
    else if (type === 'payback' && bankLoan >= 1000 && cash >= 1000) { bankLoan -= 1000; cash -= 1000; }

    const interest = Math.floor(bankLoan * 0.1);
    const expenses = financials.expenses || {};

    const patch = {
        financials: {
            ...financials, cash,
            liabilities: { ...liabilities, bank_loan: bankLoan },
            expenses: { ...expenses, loan_interest: interest }
        }
    };
    await supabase.rpc('merge_participant_state', { target_user_id: currentUserId, state_patch: patch });
};
btnBorrowLoan.addEventListener('click', () => triggerLoanRPC('borrow'));
btnPaybackLoan.addEventListener('click', () => triggerLoanRPC('payback'));

btnCheckCalculations.onclick = async () => {
    const totalIncomeInput = parseInt(inputTotalIncome.value, 10) || 0;
    const netCashflowInput = parseInt(inputNetCashflow.value, 10) || 0;
    const record = cachedParticipants.find(p => p.user_id === currentUserId);
    const financials = record.state.financials || {};

    if (totalIncomeInput === financials.total_income && netCashflowInput === financials.net_cash_flow) {
        await supabase.rpc('merge_participant_state', { target_user_id: currentUserId, state_patch: { is_calculating: false } });
        alert("計算チェッククリア！ロックが解除されました。");
    } else {
        alert("計算項目とDBの整合数値が合致しません。");
    }
};
