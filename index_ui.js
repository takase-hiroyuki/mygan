// index_ui.js

import { SEL_G } from './common_dom_selectors.js'; 
import { setButtonActive,
         setMultipleButtonsActive,
         BOARD_CELL_NAMES,
         CELLS_OPPORTUNITY } from './common_utils.js'; // ★修正: CELLS_OPPORTUNITY を追加インポート

const sectionLogin = document.getElementById(SEL_G.LOGIN.SECTION);
const sectionGuest = document.getElementById(SEL_G.STATUS.SECTION);
const diceStatusArea = document.getElementById(SEL_G.CONTROLS.DICE_USER);
const guestDiceResult = document.getElementById(SEL_G.CONTROLS.DICE_RESULT);

let previousTurnUserId = null;

// ★ プルダウン変更時の再描画のために、最新のデータを保持しておく変数
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
    // 再描画用に最新状態を保持
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
        
        // ダミーのRPC関数を呼び出す（システムメッセージ送信の代替）
        await dummyRpcCall('insertSystemMessage', { targetName, message: `${targetName} はサイコロを振って下さい` });
        
        previousTurnUserId = turnUserId;
    }

    const safeUpdate = (selectorId, text) => {
        if (selectorId) {
            const el = document.getElementById(selectorId);
            if (el) el.textContent = text;
        }
    };

    // ご自身のステータス表示の更新
    safeUpdate(SEL_G.STATUS.NAME, state.name || "");
    safeUpdate(SEL_G.STATUS.CURRENT_CASH, toCurrency(financials.cash));
    safeUpdate(SEL_G.STATUS.PROFESSION, state.profession || "未定");
    safeUpdate(SEL_G.STATUS.CHILDREN_COUNT, state.children_count || 0);
    safeUpdate(SEL_G.STATUS.PER_CHILD_EXPENSE, toCurrency(financials.per_child_expense));

    // 盤面（すごろく）の更新
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

    // =========================================================================
    // 財務諸表エリアの更新（参加者プルダウンの生成と連動）
    // =========================================================================
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

    // =========================================================================
    // 財務諸表エリアの更新（テーブルとプルダウンの動的生成）
    // =========================================================================
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

        // ★ 変更: assetsHTML のヘッダーを「単価」「数量」に変更
        let assetsHTML = "<table border='1' width='100%' style='font-size: 0.9em; text-align: left;'><tr><th>資産名</th><th>単価</th><th>数量</th><th>CF</th></tr>";
        let liabHTML = "<table border='1' width='100%' style='font-size: 0.9em; text-align: left;'><tr><th>負債名</th><th>負債残高</th><th>CF</th></tr>";
        
        // ★ 操作対象を選択するプルダウンの選択肢（初期値）
        let optionsHTML = '<option value="">対象の資産・負債を選択</option>';

        selectedItems.forEach(item => {
            if (item.liability > 0 || item.cashflow < 0) {
                const cfStr = item.cashflow < 0 ? toCurrency(item.cashflow) : `+${toCurrency(item.cashflow)}`;
                liabHTML += `<tr><td>${item.title}</td><td>${item.liability > 0 ? toCurrency(item.liability) : '0'}</td><td style="color:red;">${cfStr}</td></tr>`;
                
                // ★ 負債残高があるものだけを「返済」の選択肢としてプルダウンに追加
                if (item.liability > 0) {
                    optionsHTML += `<option value="${item.id}">【返済】${item.title} (残高: $${toCurrency(item.liability)})</option>`;
                }
            } else {
                const cfStr = item.cashflow <= 0 ? toCurrency(item.cashflow) : `+${toCurrency(item.cashflow)}`;
                
                // ★ 追加: 単価と数量の取得（数量データがない場合はデフォルトの1とする）
                const unitPrice = item.cost > 0 ? toCurrency(item.cost) : '0';
                const quantity = item.quantity !== undefined ? item.quantity : 1; 
                const quantityStr = Number(quantity).toLocaleString(); // カンマ区切りにする
                
                // ★ 変更: 資産テーブルの行に「単価」と「数量」を組み込む
                assetsHTML += `<tr><td>${item.title}</td><td>${unitPrice}</td><td>${quantityStr}</td><td style="color:blue;">${cfStr}</td></tr>`;
                
                // ★ 変更: 売却の選択肢にも単価と数量を表示させる
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
        
        // ★ 画面下の「対象の資産・負債を選択」プルダウンに選択肢を流し込む
        const elProfitLossSelect = document.getElementById(SEL_G.FINANCIALS.PROFIT_LOSS_SELECT);
        if (elProfitLossSelect) elProfitLossSelect.innerHTML = optionsHTML;
    }

    // ★追加: トレード相手（自分以外）のプルダウンを生成
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
        // 再描画前の選択を復元（もしあれば）
        if (currentTarget && cachedParticipants.some(p => p.user_id === currentTarget)) {
            sellTargetSelect.value = currentTarget;
        }
    }

    // =========================================================================
    // ★ 修正箇所：カード内容の表示と「売る」ボタンのアクティブ制御
    // =========================================================================
    if (isMyTurn && state.drawn_card) {
        // カードを引いている場合
        const card = state.drawn_card;
        safeUpdate(SEL_G.TRADE.THIS_CARD, `【${card.title}】\n${card.description_jp || ''}`);
        
        // カードの is_resellable フラグをみて「売る」ボタンを制御
        setButtonActive(SEL_G.TRADE.BTN_SELL, !!card.is_resellable);
        
        // 「自分で処理する」ボタンはカードを引いていれば常にアクティブ
        setButtonActive(SEL_G.TRADE.BTN_PROCESS_SELF, true);
        
    } else if (isMyTurn && flags.has_rolled_dice && CELLS_OPPORTUNITY.includes(state.position) && !flags.is_card_drawn) {
        // 商売マスに止まり、まだカードを引いていない場合
        safeUpdate(SEL_G.TRADE.THIS_CARD, "普通の商売、または大きな商売、のどちらかをひいてください");
        setButtonActive(SEL_G.TRADE.BTN_SELL, false);
        setButtonActive(SEL_G.TRADE.BTN_PROCESS_SELF, false);
    } else {
        // それ以外の場合（待ち状態など）
        safeUpdate(SEL_G.TRADE.THIS_CARD, "場に出たカード");
        setButtonActive(SEL_G.TRADE.BTN_SELL, false);
        setButtonActive(SEL_G.TRADE.BTN_PROCESS_SELF, false);
    }
    
    safeUpdate(SEL_G.TRADE.TRADE_MESSAGE, "受け取るメッセージ (とりあえず機能なし)");


    if (!isPlaying) {
        if (diceStatusArea) diceStatusArea.textContent = "ホストがゲームを開始するまでお待ちください。";
        disableAllActionButtons();
    } else {
        const turnUser = cachedParticipants.find(p => p.user_id === turnUserId);
        const turnUserName = turnUser ? turnUser.state.name : "他のプレイヤー";        

        if (isMyTurn) {
            const pendingPaydays = parseInt(flags.pending_paydays || 0, 10);
            
            // 未処理の入金がある場合のみ、入金請求ボタンを有効化する
            setButtonActive(SEL_G.CONTROLS.BTN_PAYCHECK, pendingPaydays > 0);

            // データベースのフラグでサイコロを振ったかを厳密に判定
            if (flags.has_rolled_dice) {
                if (diceStatusArea) {
                    if (pendingPaydays > 0) {
                        diceStatusArea.textContent = `結果:【${state.last_dice}】 入金請求（${pendingPaydays}回分）`;
                    } else {
                        diceStatusArea.textContent = `結果:【${state.last_dice}】`;
                    }
                }
                
                // サイコロを振った後はサイコロボタンを無効化する
                setButtonActive(SEL_G.CONTROLS.BTN_DICE1, false);
                setButtonActive(SEL_G.CONTROLS.BTN_DICE_2, false);
                
                // カードを引いている最中などはターン終了できないように制御
                const canEndTurn = !flags.is_calculating && flags.is_action_completed;
                setButtonActive(SEL_G.CONTROLS.BTN_END_TURN, canEndTurn);

            } else {
                if (diceStatusArea) diceStatusArea.textContent = "あなたの手番";
                
                const charityTurnsLeft = parseInt(flags.charity_turns_left || 0, 10);
                
                // まだサイコロを振っていない場合、寄付状態に応じてサイコロボタンを有効化する
                setButtonActive(SEL_G.CONTROLS.BTN_DICE1, true);
                setButtonActive(SEL_G.CONTROLS.BTN_DICE_2, charityTurnsLeft > 0);
                
                // ターン終了は不可
                setButtonActive(SEL_G.CONTROLS.BTN_END_TURN, false);
                
                setMultipleButtonsActive([
                    SEL_G.CARD.BTN_SMALL_DEAL, 
                    SEL_G.CARD.BTN_BIG_DEAL
                ], false);
            }
            
            setButtonActive(SEL_G.FINANCIALS.BTN_C_CASHFLOW, !!flags.is_calculating);
            
            setButtonActive(SEL_G.LOAN.BTN_BORROW_LOAN, true);
            setButtonActive(SEL_G.LOAN.BTN_PAYBACK_LOAN, true);

            // ★追加: 自分の手番なら、資産・負債の処理ボタンを常に有効にする
            setButtonActive(SEL_G.FINANCIALS.BTN_OPERATE, true);
            
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
        TRADE.BTN_PROCESS_SELF // ★追加
    ];
    
    setMultipleButtonsActive(actionButtonIds.filter(Boolean), false);
}

// ============================================================================
// ダミーRPC関数群
// ============================================================================
export async function dummyRpcCall(rpcName, payload) {
    console.log(`[Dummy RPC] 実行されました: ${rpcName}`, payload);
    return { data: null, error: null };
}

console.log("【デバッグ】index_ui.js が読み込まれました。");
