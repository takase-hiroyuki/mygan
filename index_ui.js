// index_ui.js

/*
変更のポイントとJavaScript側の役割
このように id="select-player-statement" を付けたプルダウンを用意しておくことで、JavaScript側で以下の3つの連携が非常にスムーズに行えます。

リストの自動生成
ゲームに参加しているプレイヤーのデータ（名前とID）を取得し、この <select> の中に <option> として自動的に追加します。最初は「自分」が選択された状態にしておきます。

切り替え時の表示更新
このプルダウンが変更された時（change イベント）に、選ばれたプレイヤーのデータ（state->items など）を読み込み、下の「資産 table」と「負債 table」を描画し直します。

「自分だけが操作可能」の制御（重要）
選ばれているプレイヤーIDが 「自分のID」と一致するかどうか を判定します。

一致する（自分）場合：一番下の「処理する」ボタン（b-operate）や入力欄を表示（または有効化）します。
一致しない（他人）場合：他人の資産を勝手に売れないように、「処理する」部分のHTMLをごっそり非表示（または disabled）にします。
*/

import { SEL_G } from './common_dom_selectors.js'; 
import { setButtonActive,
         setMultipleButtonsActive,
         BOARD_CELL_NAMES } from './common_utils.js'; 

const sectionLogin = document.getElementById(SEL_G.LOGIN.SECTION);
const sectionGuest = document.getElementById(SEL_G.STATUS.SECTION);
const diceStatusArea = document.getElementById(SEL_G.CONTROLS.DICE_USER);
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

    // ステータス表示の更新
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
    // 財務諸表エリアの更新（参加者プルダウンの生成）
    // =========================================================================
    const playerSelect = document.getElementById(SEL_G.FINANCIALS.PLAYER_SELECT);
    if (playerSelect) {
        const currentValue = playerSelect.value; // 現在選ばれている人を記憶
        playerSelect.innerHTML = ''; // 一旦リストを空にする
        
        // 参加者全員をリストに追加
        cachedParticipants.forEach(p => {
            if (p.state && p.state.name) {
                const option = document.createElement('option');
                option.value = p.user_id;
                option.textContent = p.state.name + ' の財務諸表';
                playerSelect.appendChild(option);
            }
        });
        
        // 記憶していた選択状態を復元（なければ「自分」を選択）
        if (currentValue && cachedParticipants.some(p => p.user_id === currentValue)) {
            playerSelect.value = currentValue;
        } else {
            playerSelect.value = currentUserId;
        }
    }

    // 財務諸表エリアの更新（シンプル化）
    if (Object.keys(financials).length > 0) {
        safeUpdate(SEL_G.FINANCIALS.D_SALARY, toCurrency(financials.salary));
        safeUpdate(SEL_G.FINANCIALS.D_CASHFLOW, `キャッシュフロー： ${toCurrency(financials.net_cash_flow)}`);
        
        safeUpdate(SEL_G.FINANCIALS.D_PROFIT, "資産 table (とりあえず機能なし)");
        safeUpdate(SEL_G.FINANCIALS.D_LOSS, "負債 table (とりあえず機能なし)");
    }

    // 取引（トレード）エリアのプレースホルダー更新
    safeUpdate(SEL_G.TRADE.THIS_CARD, "場に出たカード (とりあえず機能なし)");
    safeUpdate(SEL_G.TRADE.TRADE_MESSAGE, "受け取るメッセージ (とりあえず機能なし)");

    if (!isPlaying) {
        if (diceStatusArea) diceStatusArea.textContent = "ホストがゲームを開始するまでお待ちください。";
        disableAllActionButtons();
    } else {
        const turnUser = cachedParticipants.find(p => p.user_id === turnUserId);
        const turnUserName = turnUser ? turnUser.state.name : "他のプレイヤー";        

        if (isMyTurn) {
            if (state.last_dice > 0) {
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
                
                // ドローボタンの無効化
                setMultipleButtonsActive([
                    SEL_G.CARD.BTN_SMALL_DEAL, 
                    SEL_G.CARD.BTN_BIG_DEAL
                ], false);
            }
            
            setButtonActive(SEL_G.FINANCIALS.BTN_C_CASHFLOW, !!flags.is_calculating);
            
            // アイテム化に伴い、一旦ローンボタンは常に押せるようにしておく（後ほどプルダウン操作に統合）
            setButtonActive(SEL_G.LOAN.BTN_BORROW_LOAN, true);
            setButtonActive(SEL_G.LOAN.BTN_PAYBACK_LOAN, true);
            
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
        TRADE.BTN_REJECT
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
