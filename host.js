// host.js
import { roomId, SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { DOM_SELECTORS } from './dom_selectors.js';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
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
    console.log("【デバッグ】initHost リアルタイム監視開始 部屋番号:", roomId);
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
            if (isPlaying) {
                btnInitialShuffleStart.disabled = true;
                btnInitialShuffleStart.textContent = 'X ゲーム開始 (ダイス検証モード)';
            } else {
                btnInitialShuffleStart.disabled = false;
                btnInitialShuffleStart.textContent = 'O ゲーム開始 (ダイス検証モード)';
            }
        } 
        
        /* [機能キャンセルアウト] 山札枚数監視の同期判定
        updateDeckView(state);
        */
    }
    drawHostScreen();
}

/* [機能キャンセルアウト] 山札モニター表示処理
function updateDeckView(gameState) {
    const selectors = DOM_SELECTORS.HOST.DECK_MONITOR;
    const decks = gameState.decks || {};
    document.getElementById(selectors.SMALL_DEAL_COUNT).textContent = Array.isArray(decks.small_deal) ? decks.small_deal.length : 0;
    document.getElementById(selectors.BIG_DEAL_COUNT).textContent = Array.isArray(decks.big_deal) ? decks.big_deal.length : 0;
    document.getElementById(selectors.MARKET_COUNT).textContent = Array.isArray(decks.market) ? decks.market.length : 0;
    document.getElementById(selectors.DOODAD_COUNT).textContent = Array.isArray(decks.doodad) ? decks.doodad.length : 0;
}
*/

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
            <td>${position === 0 ? "00給料" : `${position} 番マス`}</td>
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

// 初期シャッフル＆開始をモック状態(status: playing)へアトミックに変更する処理へ限定化
btnInitialShuffleStart?.addEventListener('click', async (event) => {
    const debugFunctionName = event.currentTarget.id;
    console.log("【デバッグ1】", debugFunctionName);

    if (!confirm("サイコロ検証用ゲームを開始しますか？")) return;
    btnInitialShuffleStart.disabled = true;
    btnInitialShuffleStart.textContent = 'X ゲーム開始 (ダイス検証モード)';
    
    // データ整合性のための最小限ルームステータスplaying化パッチ
    const { error } = await supabase.from('rooms').update({
        game_state: { status: "playing", decks: { small_deal:[], big_deal:[], market:[], doodad:[] }, current_card: null }
    }).eq('id', roomId);

    console.log("【デバッグ2】", debugFunctionName);

    if (error) {
        alert(error.message);
        btnInitialShuffleStart.disabled = false;
        btnInitialShuffleStart.textContent = 'O ゲーム開始 (ダイス検証モード)';
    } else {
        // 最初のプレイヤーに強制手番付与
        if (currentParticipants.length > 0) {
            await supabase.from('rooms').update({ current_turn_user_id: currentParticipants[0].user_id }).eq('id', roomId);
        }
        await syncAndFetchRoom();
        btnInitialShuffleStart.textContent = 'X ゲーム開始 (ダイス検証モード)';
    }

    console.log("【デバッグ3】", debugFunctionName);

});

/* [機能キャンセルアウト] 強制終了・手番制御・キック・手動リシャッフル
btnForceGameEnd?.addEventListener('click', async () => {
    if (!confirm("全員を退室させゲームを強制終了しますか？")) return;
    const { error } = await supabase.from('participants').delete().eq('room_id', roomId);
    if (!error) {
        await supabase.from('rooms').update({ current_turn_user_id: null, game_state: null }).eq('id', roomId);
        alert("強制リセットが完了しました。");
        window.location.reload();
    }
});

btnSetTurn?.addEventListener('click', async () => {
    const order = parseInt(inputNextTurnOrder.value, 10);
    if (isNaN(order) || order < 1 || order > currentParticipants.length) {
        alert("入力順の指定が不正です。"); return;
    }
    const targetPlayer = currentParticipants[order - 1];
    await supabase.rpc('merge_participant_state', { target_user_id: targetPlayer.user_id, state_patch: { last_dice: 0 } });
    await supabase.from('rooms').update({ current_turn_user_id: targetPlayer.user_id }).eq('id', roomId);
    inputNextTurnOrder.value = '';
});

btnKickParticipant?.addEventListener('click', async () => {
    const order = parseInt(inputKickOrder.value.trim(), 10);
    if (isNaN(order) || order < 1 || order > currentParticipants.length) {
        alert("指定されたプレイヤー番号が不正です。"); return;
    }
    const targetPlayer = currentParticipants[order - 1];
    if (confirm(`プレイヤー「${targetPlayer.state?.name}」を退室させますか？`)) {
        await supabase.from('participants').delete().eq('room_id', roomId).eq('user_id', targetPlayer.user_id);
        inputKickOrder.value = '';
    }
});

const bindManualShuffle = (btn, type) => {
    btn?.addEventListener('click', async () => {
        const { data } = await supabase.rpc('manual_reshuffle_deck', { p_room_id: roomId, p_host_user_id: HOST_ADMIN_ID, p_deck_type: type });
        if (data?.success) alert("山札の再シャッフルが完了しました。");
    });
};
bindManualShuffle(btnReshuffleSmall, 'small_deal');
bindManualShuffle(btnReshuffleBig, 'big_deal');
bindManualShuffle(btnReshuffleMarket, 'market');
bindManualShuffle(btnReshuffleDoodad, 'doodad');
*/

console.log("【デバッグ】host.js が読み込まれました。");
