// host.js
import { roomId, SUPABASE_URL, SUPABASE_KEY } from './common_config.js';
import { DOM_SELECTORS } from './common_dom_selectors.js';
import { setButtonActive, BOARD_CELL_NAMES, waitForSupabase, callRpcWithDebug, insertSystemMessage } from './common_utils.js'; 

let supabase = null;
const listBody = document.getElementById(DOM_SELECTORS.HOST.PARTICIPANT_LIST);
const flagsListBody = document.getElementById(DOM_SELECTORS.HOST.FLAGS_LIST);
const displayRoomStatus = document.getElementById(DOM_SELECTORS.HOST.LIFECYCLE.DISPLAY_ROOM_STATUS);
const btnInitialShuffleStart = document.getElementById(DOM_SELECTORS.HOST.LIFECYCLE.BTN_INITIAL_SHUFFLE);
const btnForceGameEnd = document.getElementById(DOM_SELECTORS.HOST.LIFECYCLE.BTN_FORCE_GAME_END);
const hostDiceMonitor = document.getElementById(DOM_SELECTORS.HOST.DICE_MONITOR);
const inputNextTurnOrder = document.getElementById(DOM_SELECTORS.HOST.TURN_CONTROL.INPUT_NEXT_ORDER);
const btnSetTurn = document.getElementById(DOM_SELECTORS.HOST.TURN_CONTROL.BTN_SET_TURN);
const inputKickOrder = document.getElementById(DOM_SELECTORS.HOST.KICK_CONTROL.INPUT_KICK_ORDER);
const btnKickParticipant = document.getElementById(DOM_SELECTORS.HOST.KICK_CONTROL.BTN_KICK_PARTICIPANT);

console.log("【デバッグ】const 終了");

let currentParticipants = [];
let activeRoomRecord = null;

(async function initHost() {
    console.log("【デバッグ】initHost 監視開始 部屋番号:", roomId);
    
    const supabaseGlobal = await waitForSupabase();
    supabase = supabaseGlobal.createClient(SUPABASE_URL, SUPABASE_KEY);

    await syncAndFetchRoom();

    supabase.channel('public:host_participants').on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, async () => {
        const { data } = await supabase.from('participants').select('*').eq('room_id', roomId).order('id', { ascending: true });
        if (data) {
            currentParticipants = data;
            drawHostScreen();
        }
    }).subscribe();

    supabase.channel('public:host_rooms').on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, () => {
        syncAndFetchRoom();
    }).subscribe();
})();

async function syncAndFetchRoom() {
    if (!supabase) return;
    console.log("【デバッグ】syncAndFetchRoom 実行");

    const [resPart, resRoom] = await Promise.all([
        supabase.from('participants').select('*').eq('room_id', roomId).order('id', { ascending: true }),
        supabase.from('rooms').select('*').eq('id', roomId).maybeSingle()
    ]);

    if (resPart.data) {
        currentParticipants = resPart.data;
    }

    if (resRoom.data) {
        activeRoomRecord = resRoom.data;
        const state = activeRoomRecord.game_state || {};
        const isPlaying = state.status === 'playing';

        if (displayRoomStatus) displayRoomStatus.textContent = isPlaying ? 'playing (ゲーム進行中)' : 'waiting (準備中)';
        
        if (btnInitialShuffleStart) {
            setButtonActive(DOM_SELECTORS.HOST.LIFECYCLE.BTN_INITIAL_SHUFFLE, !isPlaying);
        } 
    }
    drawHostScreen();
}

function drawHostScreen() {
    const state = activeRoomRecord?.game_state || {};
    const decks = state.decks || {};
    const currentTurnUserId = activeRoomRecord ? activeRoomRecord.current_turn_user_id : null;

    const elSmallCount = document.getElementById(DOM_SELECTORS.HOST.DECK_MONITOR.SMALL_DEAL_COUNT);
    if (elSmallCount) elSmallCount.textContent = `${decks.small_deal ? decks.small_deal.length : 0} 枚`;

    const elBigCount = document.getElementById(DOM_SELECTORS.HOST.DECK_MONITOR.BIG_DEAL_COUNT);
    if (elBigCount) elBigCount.textContent = `${decks.big_deal ? decks.big_deal.length : 0} 枚`;

    const elMarketCount = document.getElementById(DOM_SELECTORS.HOST.DECK_MONITOR.MARKET_COUNT);
    if (elMarketCount) elMarketCount.textContent = `${decks.market ? decks.market.length : 0} 枚`;

    const elDoodadCount = document.getElementById(DOM_SELECTORS.HOST.DECK_MONITOR.DOODAD_COUNT);
    if (elDoodadCount) elDoodadCount.textContent = `${decks.doodad ? decks.doodad.length : 0} 枚`;

    if (hostDiceMonitor) {
        if (!currentTurnUserId) {
            hostDiceMonitor.textContent = "手番が設定されていません";
        } else {
            const player = currentParticipants.find(p => p.user_id === currentTurnUserId);
            hostDiceMonitor.textContent = `次は ${player?.state?.name || currentTurnUserId} の番です`;
        }
    }

    const itemSEL = DOM_SELECTORS.HOST.PARTICIPANT_ITEM;
    const boardSEL = DOM_SELECTORS.HOST.BOARD;
    
    if (listBody) listBody.innerHTML = '';
    if (flagsListBody) flagsListBody.innerHTML = ''; 
    
    for (let i = 0; i < 24; i++) {
        const cell = document.getElementById(`${boardSEL.CELL_PREFIX}${i}`);
        if (cell) cell.innerHTML = '';
    }

    currentParticipants.forEach((p, idx) => {
        const pState = p.state || {};
        const financials = pState.financials || {};
        const position = pState.position ?? 0;
        const flags = pState.flags || {}; 

        const isCurrentTurn = (p.user_id === currentTurnUserId);
        const displayName = (isCurrentTurn ? '★' : '') + (pState.name || '不明');

        const tr = document.createElement('tr');
        tr.classList.add(itemSEL.ROW_CLASS);
        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td>${displayName} (${p.user_id})</td>
            <td class="${itemSEL.PROFESSION_CLASS}">${pState.profession || '未定'}</td>
            <td>${pState.children_count || 0}</td>
            <td>${String(position).padStart(2, '0')}${BOARD_CELL_NAMES[position] || ""}</td>
            <td>$${(financials.cash || 0).toLocaleString()}</td>
        `;
        if (listBody) listBody.appendChild(tr);

        if (flagsListBody) {
            const charityLeft = parseInt(flags.charity_turns_left || 0, 10);
            const downsizedLeft = parseInt(flags.downsized_turns_left || 0, 10);

            const trFlags = document.createElement('tr');
            trFlags.innerHTML = `
                <td>${displayName}</td>
                <td>${!!flags.has_rolled_dice}</td>
                <td>${flags.pending_paydays || 0}</td>
                <td>${!!flags.is_card_drawn}</td>
                <td>${!!flags.is_action_completed}</td>
                <td>${!!flags.is_calculating}</td>
                <td style="font-weight: bold; color: ${charityLeft > 0 ? '#4caf50' : 'inherit'};">${charityLeft}</td>
                <td style="font-weight: bold; color: ${downsizedLeft > 0 ? '#f44336' : 'inherit'};">${downsizedLeft}</td>
                <td>${!!flags.is_negative_cash_flow}</td>
            `;
            flagsListBody.appendChild(trFlags);
        }

        const targetCell = document.getElementById(`${boardSEL.CELL_PREFIX}${position}`);
        if (targetCell) {
            const table = document.createElement('table');
            table.setAttribute('border', '0');
            table.setAttribute('cellspacing', '0');
            table.setAttribute('cellpadding', '2');
            table.setAttribute('width', '100%');
            const trNode = document.createElement('tr');
            const tdNode = document.createElement('td');
            tdNode.setAttribute('bgcolor', '#00bcd4');
            tdNode.setAttribute('align', 'center');
            const fontNode = document.createElement('font');
            const fontNodeColor = 'white';
            fontNode.setAttribute('color', fontNodeColor);
            fontNode.setAttribute('size', '2');
            fontNode.textContent = displayName;
            
            tdNode.appendChild(fontNode);
            trNode.appendChild(tdNode);
            table.appendChild(trNode);
            targetCell.appendChild(targetCell.firstChild ? document.createElement('br') : document.createDocumentFragment());
            targetCell.appendChild(table);
        }
    });
}

// 配列をシャッフルするヘルパー関数 (Fisher-Yates アルゴリズム)
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

btnInitialShuffleStart?.addEventListener('click', async () => {
    if (!supabase) return;
    setButtonActive(DOM_SELECTORS.HOST.LIFECYCLE.BTN_INITIAL_SHUFFLE, false);

    try {
        // 1. 職業と順番の決定
        await callRpcWithDebug(supabase, 'start_game_with_professions_v2', { p_room_id: roomId });
        
        // 2. データベースから本物のカードデータをすべて取得
        const { data: allCards, error: cardsError } = await supabase.from('cards').select('*');
        if (cardsError) {
            console.error("【デバッグ】カードデータの取得失敗:", cardsError);
            throw new Error(`カードデータの取得に失敗しました: ${cardsError.message}`);
        }

        // 3. 取得したカードを deck_type ごとに分類し、それぞれシャッフル
        const decks = {
            small_deal: shuffleArray(allCards.filter(c => c.deck_type === 'small_deal')),
            big_deal: shuffleArray(allCards.filter(c => c.deck_type === 'big_deal')),
            market: shuffleArray(allCards.filter(c => c.deck_type === 'market')),
            doodad: shuffleArray(allCards.filter(c => c.deck_type === 'doodad'))
        };
        
        // 4. 生成したデッキを rooms テーブルの game_state に保存
        const { data: roomData, error: roomError } = await supabase.from('rooms').select('game_state').eq('id', roomId).single();
        if (roomError) {
            console.error("【デバッグ】部屋の取得失敗:", roomError);
            throw new Error(`部屋情報の取得に失敗しました: ${roomError.message}`);
        }

        const currentState = roomData?.game_state || {};
        currentState.decks = decks;
        
        const { error: updateError } = await supabase.from('rooms').update({ game_state: currentState }).eq('id', roomId);
        if (updateError) {
            console.error("【デバッグ】デッキの保存失敗:", updateError);
            throw new Error(`デッキの保存に失敗しました: ${updateError.message}`);
        }

        await syncAndFetchRoom();
    } catch (error) {
        console.error("【デバッグ】ゲーム開始処理エラー:", error);
        await insertSystemMessage(supabase, "ホスト", `ゲーム開始失敗: ${error.message}`);
        setButtonActive(DOM_SELECTORS.HOST.LIFECYCLE.BTN_INITIAL_SHUFFLE, true);
    }
});

btnKickParticipant?.addEventListener('click', async () => {
    if (!supabase) return;
    const orderInput = inputKickOrder.value.trim();
    const orderIdx = parseInt(orderInput, 10) - 1;
    
    if (isNaN(orderIdx) || orderIdx < 0 || orderIdx >= currentParticipants.length) {
        await insertSystemMessage(supabase, "ホスト", "有効な退室者の番号（入室順）を入力してください。");
        return;
    }

    const targetUser = currentParticipants[orderIdx];

    try {
        await callRpcWithDebug(supabase, 'kick_participant', { 
            p_room_id: roomId, 
            p_target_user_id: targetUser.user_id 
        });
        inputKickOrder.value = '';
        await syncAndFetchRoom();
    } catch (error) {
        await insertSystemMessage(supabase, "ホスト", `退室処理失敗: ${error.message}`);
    }
});

btnSetTurn?.addEventListener('click', async () => {
    if (!supabase) return;
    const orderInput = inputNextTurnOrder.value.trim();
    const orderIdx = parseInt(orderInput, 10) - 1;
    
    if (isNaN(orderIdx) || orderIdx < 0 || orderIdx >= currentParticipants.length) {
        await insertSystemMessage(supabase, "ホスト", "有効なプレイヤーの番号（入室順）を入力してください。");
        return;
    }

    const targetUser = currentParticipants[orderIdx];

    try {
        await callRpcWithDebug(supabase, 'force_set_turn', { 
            p_room_id: roomId, 
            p_target_user_id: targetUser.user_id 
        });
        inputNextTurnOrder.value = '';
        await syncAndFetchRoom();
    } catch (error) {
        await insertSystemMessage(supabase, "ホスト", `手番変更失敗: ${error.message}`);
    }
});

btnForceGameEnd?.addEventListener('click', async () => {
    if (!supabase) return;
    
    const { error: deleteError } = await supabase.from('participants').delete().eq('room_id', roomId);
        
    if (!deleteError) {
        const { error: updateError } = await supabase
            .from('rooms')
            .update({ 
                current_turn_user_id: null, 
                game_state: { status: "waiting" } 
            })
            .eq('id', roomId);
            
        if (updateError) {
            await insertSystemMessage(supabase, "ホスト", `部屋の状態リセットに失敗しました: ${updateError.message}`);
        } else {
            window.location.reload();
        }
    } else {
        await insertSystemMessage(supabase, "ホスト", `参加者の退室処理に失敗しました: ${deleteError.message}`);
    }
});

console.log("【残す】host.js が読み込まれました。");
