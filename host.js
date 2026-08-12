// host.js
import { roomId, SUPABASE_URL, SUPABASE_KEY } from './common_config.js';
import { DOM_SELECTORS } from './common_dom_selectors.js';
import { setButtonActive, BOARD_CELL_NAMES, waitForSupabase, callRpcWithDebug, insertSystemMessage, writeLog } from './common_utils.js';

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

const btnFetchLogs = document.getElementById('btn-fetch-logs');
const btnFetchCurrentGameLogs = document.getElementById('btn-fetch-current-game-logs'); 
const btnCopyLogs = document.getElementById('btn-copy-logs');
const hostLogTextarea = document.getElementById('host-log-textarea');

let currentParticipants = [];
let activeRoomRecord = null;

(async function initHost() {
    const supabaseGlobal = await waitForSupabase();
    supabase = supabaseGlobal.createClient(SUPABASE_URL, SUPABASE_KEY);

    writeLog(supabase, "Host", "System", `initHost 監視開始 部屋番号: ${roomId}`);

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
    writeLog(supabase, "Host", "System", "syncAndFetchRoom 実行");

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
                <td>${charityLeft}</td>
                <td>${downsizedLeft}</td>
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
            fontNode.setAttribute('color', 'white');
            fontNode.setAttribute('size', '2');
            fontNode.textContent = displayName;
            
            tdNode.appendChild(fontNode);
            trNode.appendChild(tdNode);
            table.appendChild(trNode);
            targetCell.appendChild(targetCell.firstChild ? document.createElement('br') : document.createDocumentFragment());
            targetCell.appendChild(table);
        }
    });

    const extraContainer = document.getElementById(DOM_SELECTORS.HOST.EXTRA_INFO_CONTAINER);
    if (extraContainer) {
        let extraHtml = ``;
        const currentCard = state.current_card;
        if (currentCard) {
            extraHtml += `<p>タイトル: ${currentCard.title}  asset_type: ${currentCard.asset_type}</p>`;
        } else {
            extraHtml += `<p>現在、場に出ているカードはありません。</p>`;
        }

        extraHtml += `<table border="1" width="100%">`;
        extraHtml += `<tr><th>名前</th><th>給料</th><th>不労所得</th><th>経費</th><th>キャッシュフロー</th><th>ファーストトラックまで</th></tr>`;

        currentParticipants.forEach(p => {
            const pState = p.state || {};
            const items = pState.items || [];
            
            let salary = 0;
            let passiveIncome = 0;
            let totalExpenses = 0;
            
            items.forEach(item => {
                const costVal = Number(item.cost || 0);
                const liabVal = Number(item.liability || 0);
                const cfVal = Number(item.cashflow || 0);
                
                if (cfVal < 0) {
                    totalExpenses += Math.abs(cfVal);
                } else if (cfVal > 0) {
                    if (costVal > 0 || liabVal > 0) {
                        passiveIncome += cfVal;
                    } else {
                        salary += cfVal;
                    }
                }
            });
            
            const cashflow = salary + passiveIncome - totalExpenses;
            const ftDiff = totalExpenses - passiveIncome;
            const ftText = ftDiff > 0 ? `あと $${ftDiff.toLocaleString()}` : "移行可能！";
            
            extraHtml += `<tr>
                <td>${pState.name || '不明'}</td>
                <td>$${salary.toLocaleString()}</td>
                <td>$${passiveIncome.toLocaleString()}</td>
                <td>$${totalExpenses.toLocaleString()}</td>
                <td>$${cashflow.toLocaleString()}</td>
                <td>${ftText}</td>
            </tr>`;
        });
        extraHtml += `</table><br>`;

        extraHtml += `<table border="1" width="100%">`;
        extraHtml += `<tr><th>名前</th><th>保有資産一覧</th></tr>`;

        currentParticipants.forEach(p => {
            const pState = p.state || {};
            const items = pState.items || [];
            
            const assets = items.filter(item => Number(item.cost || 0) > 0 || (item.asset_type !== 'Salary' && item.asset_type !== 'ChildExpense' && item.asset_type !== 'InstantDebt' && item.asset_type !== 'BankLoan'));
            
            const assetStrs = assets.map(item => {
                let isHit = false;
                if (currentCard) {
                    if (currentCard.asset_type !== 'other') {
                        isHit = (item.asset_type === currentCard.asset_type);
                    } else if (currentCard.action_rule) {
                        if (currentCard.action_rule.target_symbol && item.asset_type === currentCard.action_rule.target_symbol) {
                            isHit = true;
                        }
                        if (Array.isArray(currentCard.action_rule.target_asset) && currentCard.action_rule.target_asset.includes(item.asset_type)) {
                            isHit = true;
                        }
                    }
                }
                
                const baseText = `[${item.asset_type}] ${item.title}`;
                if (isHit) {
                    return `<span style="background-color: yellow; color: red; font-weight: bold;">★${baseText}</span>`;
                }
                return baseText;
            }).join('<br>');
            
            extraHtml += `<tr>
                <td>${pState.name || '不明'}</td>
                <td>${assetStrs || 'なし'}</td>
            </tr>`;
        });
        extraHtml += `</table>`;

        extraContainer.innerHTML = extraHtml;
    }
}

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
    writeLog(supabase, "Host", "Action", "「初期シャッフル＆ゲーム開始」ボタンが押下されました");
    setButtonActive(DOM_SELECTORS.HOST.LIFECYCLE.BTN_INITIAL_SHUFFLE, false);

    try {
        await callRpcWithDebug(supabase, 'start_game_with_professions_v2', { p_room_id: roomId });
        
        const { data: allCards, error: cardsError } = await supabase.from('cards').select('*');
        if (cardsError) {
            writeLog(supabase, "Host", "Error", `カードデータの取得失敗: ${JSON.stringify(cardsError)}`);
            throw new Error(`カードデータの取得に失敗しました: ${cardsError.message}`);
        }

        const decks = {
            small_deal: shuffleArray(allCards.filter(c => c.deck_type === 'small_deal')),
            big_deal: shuffleArray(allCards.filter(c => c.deck_type === 'big_deal')),
            market: shuffleArray(allCards.filter(c => c.deck_type === 'market')),
            doodad: shuffleArray(allCards.filter(c => c.deck_type === 'doodad'))
        };
        
        const { data: roomData, error: roomError } = await supabase.from('rooms').select('game_state').eq('id', roomId).single();
        if (roomError) {
            writeLog(supabase, "Host", "Error", `部屋の取得失敗: ${JSON.stringify(roomError)}`);
            throw new Error(`部屋情報の取得に失敗しました: ${roomError.message}`);
        }

        const currentState = roomData?.game_state || {};
        currentState.decks = decks;
        
        const { error: updateError } = await supabase.from('rooms').update({ game_state: currentState }).eq('id', roomId);
        if (updateError) {
            writeLog(supabase, "Host", "Error", `デッキの保存失敗: ${JSON.stringify(updateError)}`);
            throw new Error(`デッキの保存に失敗しました: ${updateError.message}`);
        }

        await syncAndFetchRoom();
        writeLog(supabase, "Host", "Action", "ゲーム開始処理が正常に完了しました");
    } catch (error) {
        writeLog(supabase, "Host", "Error", `ゲーム開始処理エラー: ${error.message}`);
        await insertSystemMessage(supabase, "ホスト", `ゲーム開始失敗: ${error.message}`);
        setButtonActive(DOM_SELECTORS.HOST.LIFECYCLE.BTN_INITIAL_SHUFFLE, true);
    }
});

btnKickParticipant?.addEventListener('click', async () => {
    if (!supabase) return;
    const orderInput = inputKickOrder.value.trim();
    writeLog(supabase, "Host", "Action", `「退室させる」ボタンが押下されました (入力順: ${orderInput})`);

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
        writeLog(supabase, "Host", "Action", `プレイヤー ${targetUser.user_id} の退室処理が完了しました`);
    } catch (error) {
        await insertSystemMessage(supabase, "ホスト", `退室処理失敗: ${error.message}`);
    }
});

btnSetTurn?.addEventListener('click', async () => {
    if (!supabase) return;
    const orderInput = inputNextTurnOrder.value.trim();
    writeLog(supabase, "Host", "Action", `「を手番にする」ボタンが押下されました (入力順: ${orderInput})`);

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
        writeLog(supabase, "Host", "Action", `プレイヤー ${targetUser.user_id} への手番変更が完了しました`);
    } catch (error) {
        await insertSystemMessage(supabase, "ホスト", `手番変更失敗: ${error.message}`);
    }
});

btnForceGameEnd?.addEventListener('click', async () => {
    if (!supabase) return;
    writeLog(supabase, "Host", "Action", "「全員強制退室＆ゲーム終了」ボタンが押下されました");
    
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
            writeLog(supabase, "Host", "Action", "ゲーム終了と部屋のリセットが完了しました");
            window.location.reload();
        }
    } else {
        await insertSystemMessage(supabase, "ホスト", `参加者の退室処理に失敗しました: ${deleteError.message}`);
    }
});

btnFetchCurrentGameLogs?.addEventListener('click', async () => {
    if (!supabase) return;
    writeLog(supabase, "Host", "Action", "「今回のゲームログを取得」ボタンが押下されました");
    if (hostLogTextarea) hostLogTextarea.value = "取得中...";
    setButtonActive('btn-fetch-current-game-logs', false);
    
    try {
        const { data: startLogData, error: startLogError } = await supabase
            .from('game_logs')
            .select('sequence_num')
            .eq('room_id', roomId)
            .eq('target', 'Host')
            .eq('title', 'Action')
            .eq('body', 'ゲーム開始処理が正常に完了しました')
            .order('sequence_num', { ascending: false })
            .limit(1);

        if (startLogError) throw startLogError;

        let query = supabase
            .from('game_logs')
            .select('*')
            .eq('room_id', roomId)
            .order('sequence_num', { ascending: false })
            .limit(3000);

        if (startLogData && startLogData.length > 0) {
            query = query.gte('sequence_num', startLogData[0].sequence_num);
        }

        const { data, error } = await query;
        if (error) throw error;

        if (data && hostLogTextarea) {
            hostLogTextarea.value = data.reverse().map(log => 
                `[${new Date(log.created_at).toLocaleString()}] Target: ${log.target} | Title: ${log.title}\n${log.body}`
            ).join('\n----------------------------------------\n');
        }
    } catch (err) {
        if (hostLogTextarea) hostLogTextarea.value = `エラー: ${err.message}`;
        writeLog(supabase, "Host", "Error", `現在のゲームログの取得に失敗しました: ${err.message}`);
    }
    
    setButtonActive('btn-fetch-current-game-logs', true);
});

btnFetchLogs?.addEventListener('click', async () => {
    if (!supabase) return;
    writeLog(supabase, "Host", "Action", "「直近1000件を取得」ボタンが押下されました");
    if (hostLogTextarea) hostLogTextarea.value = "取得中...";
    setButtonActive('btn-fetch-logs', false);
    
    const { data, error } = await supabase
        .from('game_logs')
        .select('*')
        .eq('room_id', roomId)
        .order('sequence_num', { ascending: false })
        .limit(1000);
        
    if (error) {
        if (hostLogTextarea) hostLogTextarea.value = `エラー: ${error.message}`;
    } else if (data && hostLogTextarea) {
        hostLogTextarea.value = data.reverse().map(log => 
            `[${new Date(log.created_at).toLocaleString()}] Target: ${log.target} | Title: ${log.title}\n${log.body}`
        ).join('\n----------------------------------------\n');
    }
    
    setButtonActive('btn-fetch-logs', true);
});

btnCopyLogs?.addEventListener('click', () => {
    if (hostLogTextarea && hostLogTextarea.value) {
        writeLog(supabase, "Host", "Action", "「ログをコピー」ボタンが押下されました");
        navigator.clipboard.writeText(hostLogTextarea.value)
            .then(() => {
                const originalText = btnCopyLogs.innerText;
                btnCopyLogs.innerText = "O コピーしました！";
                setTimeout(() => { btnCopyLogs.innerText = originalText; }, 2000);
            })
            .catch(err => {
                writeLog(supabase, "Host", "Error", `クリップボードへのコピーに失敗しました: ${err}`);
            });
    }
});

console.log("【残す】host.js が読み込まれました。");
