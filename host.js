// host.js
import { roomId, SUPABASE_URL, SUPABASE_KEY } from './common_config.js';
import { DOM_SELECTORS } from './common_dom_selectors.js';
import { setButtonActive, BOARD_CELL_NAMES, waitForSupabase } from './common_utils.js';

let supabase = null;
const HOST_ADMIN_ID = 'host-admin-01';
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
const btnReshuffleSmall = document.getElementById(DOM_SELECTORS.HOST.DECK_MONITOR.BTN_RESHUFFLE_SMALL_DEAL);
const btnReshuffleBig = document.getElementById(DOM_SELECTORS.HOST.DECK_MONITOR.BTN_RESHUFFLE_BIG_DEAL);
const btnReshuffleMarket = document.getElementById(DOM_SELECTORS.HOST.DECK_MONITOR.BTN_RESHUFFLE_MARKET);
const btnReshuffleDoodad = document.getElementById(DOM_SELECTORS.HOST.DECK_MONITOR.BTN_RESHUFFLE_DOODAD);

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

    const state = activeRoomRecord?.game_state || {};
    const decks = state.decks || {};

    const elSmallCount = document.getElementById(DOM_SELECTORS.HOST.DECK_MONITOR.SMALL_DEAL_COUNT);
    if (elSmallCount) elSmallCount.textContent = `${decks.small_deal ? decks.small_deal.length : 0} 枚`;

    const elBigCount = document.getElementById(DOM_SELECTORS.HOST.DECK_MONITOR.BIG_DEAL_COUNT);
    if (elBigCount) elBigCount.textContent = `${decks.big_deal ? decks.big_deal.length : 0} 枚`;

    const elMarketCount = document.getElementById(DOM_SELECTORS.HOST.DECK_MONITOR.MARKET_COUNT);
    if (elMarketCount) elMarketCount.textContent = `${decks.market ? decks.market.length : 0} 枚`;

    const elDoodadCount = document.getElementById(DOM_SELECTORS.HOST.DECK_MONITOR.DOODAD_COUNT);
    if (elDoodadCount) elDoodadCount.textContent = `${decks.doodad ? decks.doodad.length : 0} 枚`;

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

        // 1. 参加者名簿テーブルの行生成
        const tr = document.createElement('tr');
        tr.classList.add(itemSEL.ROW_CLASS);
        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td>${pState.name || '不明'} (${p.user_id})</td>
            <td class="${itemSEL.PROFESSION_CLASS}">${pState.profession || '未定'}</td>
            <td>${String(position).padStart(2, '0')}${BOARD_CELL_NAMES[position] || ""}</td>
            <td>$${(financials.cash || 0).toLocaleString()}</td>
        `;
        if (listBody) listBody.appendChild(tr);

        // 2. フラグ監視テーブルの行生成（マッピング修正）
        if (flagsListBody) {
            const trFlags = document.createElement('tr');
            trFlags.innerHTML = `
                <td>${pState.name || '不明'}</td>
                <td>${!!flags.has_rolled_dice}</td>
                <td>${!!flags.is_paycheck_claimed}</td>
                <td>${!!flags.is_card_drawn}</td>
                <td>${!!flags.is_action_completed}</td>
                <td>${!!flags.is_calculating}</td>
                <td>${!!flags.is_negative_cash_flow}</td>
            `;
            flagsListBody.appendChild(trFlags);
        }

        // 3. 盤面のプレイヤーコマ描画
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
            fontNode.textContent = pState.name || '不明';
            
            tdNode.appendChild(fontNode);
            trNode.appendChild(tdNode);
            table.appendChild(trNode);
            targetCell.appendChild(targetCell.firstChild ? document.createElement('br') : document.createDocumentFragment()); // 重なり防止
            targetCell.appendChild(table);
        }
    });
}

// 【デバッグ用】ゲーム開始RPC呼び出し関数
async function debugStartGameWithProfessions(targetRoomId) {
    console.log("[DEBUG-JS] RPC: start_game_with_professions 呼び出し開始", { p_room_id: targetRoomId });
    
    try {
        const { data, error } = await supabase.rpc('start_game_with_professions', { p_room_id: targetRoomId });
        
        if (error) {
            console.error("[FATAL ERROR] RPC実行失敗:", error);
            alert(`[エラー] ゲーム開始失敗\nコード: ${error.code}\n詳細: ${error.message}\nヒント: ${error.hint}\n※コンソールを確認せよ`);
            return false;
        }
        
        console.log("[DEBUG-JS] RPC: 完了。データ:", data);
        return true;
    } catch (err) {
        console.error("[FATAL ERROR] ネットワークまたは予期せぬエラー:", err);
        alert(`[致命的エラー] ネットワークまたは予期せぬエラー\n詳細: ${err.message}`);
        return false;
    }
}

btnInitialShuffleStart?.addEventListener('click', async (event) => {
    if (!supabase) return;
    const debugFunctionName = event.currentTarget.id;
    console.log("【デバッグ1】", debugFunctionName);

    if (!confirm("職業割り当てとキャッシュフローを含めてゲームを開始しますか？")) return;
    setButtonActive(DOM_SELECTORS.HOST.LIFECYCLE.BTN_INITIAL_SHUFFLE, false);

    const success = await debugStartGameWithProfessions(roomId);

    console.log("【デバッグ2】", debugFunctionName, "success:", success);

    if (!success) {
        setButtonActive(DOM_SELECTORS.HOST.LIFECYCLE.BTN_INITIAL_SHUFFLE, true);
    } else {
        await syncAndFetchRoom();
        setButtonActive(DOM_SELECTORS.HOST.LIFECYCLE.BTN_INITIAL_SHUFFLE, false);
    }

    console.log("【デバッグ3】", debugFunctionName);
});

// ==========================================
// 全員強制退室＆ゲーム終了ボタン
// ==========================================
btnForceGameEnd?.addEventListener('click', async () => {
    if (!supabase) return;
    if (!confirm("全員を退室させゲームを強制終了しますか？")) return;
    
    const { error: deleteError } = await supabase
        .from('participants')
        .delete()
        .eq('room_id', roomId);
        
    if (!deleteError) {
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
