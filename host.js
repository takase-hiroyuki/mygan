// host.js
import { roomId, SUPABASE_URL, SUPABASE_KEY } from './common_config.js';
import { DOM_SELECTORS } from './common_dom_selectors.js';
import { setButtonActive, BOARD_CELL_NAMES, waitForSupabase } from './common_utils.js';

let supabase = null; // 修正点①：非同期で初期化するためletに変更
const HOST_ADMIN_ID = 'host-admin-01';
const listBody = document.getElementById(DOM_SELECTORS.HOST.PARTICIPANT_LIST);
const displayRoomStatus = document.getElementById(DOM_SELECTORS.HOST.LIFECYCLE.DISPLAY_ROOM_STATUS);
const btnInitialShuffleStart = document.getElementById(DOM_SELECTORS.HOST.LIFECYCLE.BTN_INITIAL_SHUFFLE);
const btnForceGameEnd = document.getElementById(DOM_SELECTORS.HOST.LIFECYCLE.BTN_FORCE_GAME_END);
const hostDiceMonitor = document.getElementById(DOM_SELECTORS.HOST.DICE_MONITOR);
const inputNextTurnOrder = document.getElementById(DOM_SELECTORS.HOST.TURN_CONTROL.INPUT_NEXT_ORDER);
const btnSetTurn = document.getElementById(DOM_SELECTORS.HOST.TURN_CONTROL.BTN_SET_TURN);
const inputKickOrder = document.getElementById(DOM_SELECTORS.HOST.KICK_CONTROL.INPUT_KICK_ORDER);
const btnKickParticipant = document.getElementById(DOM_SELECTORS.HOST.KICK_CONTROL.BTN_KICK_PARTICIPANT);
const btnReshuffleSmall = document.getElementById(DOM_SELECTORS.HOST.DECK_MONITOR.BTN_RESHUFFLE_SMALL_DEAL);
const btnReshuffleBig = document.getElementById(DOM_SELECTORS.HOST.DECK_MONITOR.BTN_RESHUFFLE_BIG_DEAL);
const btnReshuffleMarket = document.getElementById(DOM_SELECTORS.HOST.DECK_MONITOR.BTN_RESHUFFLE_MARKET);
const btnReshuffleDoodad = document.getElementById(DOM_SELECTORS.HOST.DECK_MONITOR.BTN_RESHUFFLE_DOODAD);

console.log("【デバッグ】const 終了");

let currentParticipants = [];
let activeRoomRecord = null;

(async function initHost() {
    console.log("【デバッグ】initHost 監視開始 部屋番号:", roomId);
    
    // 修正点①：Supabaseの安全な初期化を待機
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
    if (!supabase) return; // supabaseの初期化待ち
    console.log("【デバッグ】syncAndFetchRoom");

    const [resPart, resRoom] = await Promise.all([
        supabase.from('participants').select('*').eq('room_id', roomId).order('id', { ascending: true }),
        supabase.from('rooms').select('*').eq('id', roomId).maybeSingle()
    ]);

    if (resPart.data) currentParticipants = resPart.data;
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
    console.log("【デバッグ】drawHostScreen");

    if (hostDiceMonitor) {
        const activeId = activeRoomRecord ? activeRoomRecord.current_turn_user_id : null;
        if (!activeId) {
            hostDiceMonitor.textContent = "手番が設定されていません";
        } else {
            const player = currentParticipants.find(p => p.user_id === activeId);
            hostDiceMonitor.textContent = `次は ${player?.state?.name || activeId} の番です`;
        }
    }

    const itemSEL = DOM_SELECTORS.HOST.PARTICIPANT_ITEM;
    const boardSEL = DOM_SELECTORS.HOST.BOARD;
    listBody.innerHTML = '';
    
    for (let i = 0; i < 24; i++) {
        const cell = document.getElementById(`${boardSEL.CELL_PREFIX}${i}`);
        if (cell) cell.innerHTML = '';
    }

    currentParticipants.forEach((p, idx) => {
        const state = p.state || {};
        const financials = state.financials || {};
        const position = state.position ?? 0;

        const tr = document.createElement('tr');
        tr.classList.add(itemSEL.ROW_CLASS);
        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td>${state.name || '不明'} (${p.user_id})</td>
            <td class="${itemSEL.PROFESSION_CLASS}">${state.profession || '未定'}</td>
            <td>${String(position).padStart(2, '0')}${BOARD_CELL_NAMES[position] || ""}</td>
            <td>$${(financials.cash || 0).toLocaleString()}</td>
        `;
        listBody.appendChild(tr);

        const targetCell = document.getElementById(`${boardSEL.CELL_PREFIX}${position}`);
        if (targetCell) {
            const table = document.createElement('table');
            table.setAttribute('border', '0'); table.setAttribute('cellspacing', '0'); table.setAttribute('cellpadding', '2'); table.setAttribute('width', '100%');
            const trNode = document.createElement('tr'); const tdNode = document.createElement('td');
            tdNode.setAttribute('bgcolor', '#00bcd4'); tdNode.setAttribute('align', 'center');
            const fontNode = document.createElement('font'); fontNode.setAttribute('color', 'white'); fontNode.setAttribute('size', '2');
            fontNode.textContent = state.name || '不明';
            
            tdNode.appendChild(fontNode); trNode.appendChild(tdNode); table.appendChild(trNode);
            targetCell.appendChild(table);
        }
    });
}

btnInitialShuffleStart?.addEventListener('click', async (event) => {
    if (!supabase) return; // supabaseの初期化待ち
    const debugFunctionName = event.currentTarget.id;
    console.log("【デバッグ1】", debugFunctionName);

    if (!confirm("サイコロ検証用ゲームを開始しますか？")) return;
    setButtonActive(DOM_SELECTORS.HOST.LIFECYCLE.BTN_INITIAL_SHUFFLE, false);
    
    const { error } = await supabase.from('rooms').update({
        game_state: { status: "playing", decks: { small_deal:[], big_deal:[], market:[], doodad:[] }, current_card: null }
    }).eq('id', roomId);

    console.log("【デバッグ2】", debugFunctionName);

    if (error) {
        alert(error.message);
        setButtonActive(DOM_SELECTORS.HOST.LIFECYCLE.BTN_INITIAL_SHUFFLE, true);
    } else {
        if (currentParticipants.length > 0) {
            const randomIndex = Math.floor(Math.random() * currentParticipants.length);
            const firstPlayer = currentParticipants[randomIndex];
            await supabase.from('rooms').update({ current_turn_user_id: firstPlayer.user_id }).eq('id', roomId);
        }
        await syncAndFetchRoom();
        setButtonActive(DOM_SELECTORS.HOST.LIFECYCLE.BTN_INITIAL_SHUFFLE, false);
    }

    console.log("【デバッグ3】", debugFunctionName);
});

// ==========================================
// 全員強制退室＆ゲーム終了ボタン
// ==========================================
btnForceGameEnd?.addEventListener('click', async () => {
    if (!supabase) return; // supabaseの初期化待ち
    if (!confirm("全員を退室させゲームを強制終了しますか？")) return;
    
    // 1. 全参加者のデータを削除
    const { error: deleteError } = await supabase
        .from('participants')
        .delete()
        .eq('room_id', roomId);
        
    if (!deleteError) {
        // 修正点②：部屋のステータスを待機中(waiting)にリセットし、エラーを検知
        const { error: updateError } = await supabase
            .from('rooms')
            .update({ 
                current_turn_user_id: null, 
                game_state: { status: "waiting" } 
            })
            .eq('id', roomId);
            
        if (updateError) {
            alert("部屋の状態リセットに失敗しました: " + updateError.message);
        } else {
            alert("強制リセットが完了しました。");
            window.location.reload();
        }
    } else {
        alert("参加者の退室処理に失敗しました: " + deleteError.message);
    }
});

console.log("【デバッグ】host.js が読み込まれました。");
