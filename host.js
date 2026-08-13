// host.js
import { roomId, SUPABASE_URL, SUPABASE_KEY } from './common_config.js';
import { DOM_SELECTORS } from './common_dom_selectors.js';
import { setButtonActive, BOARD_CELL_NAMES, waitForSupabase, callRpcWithDebug, insertSystemMessage, writeLog, toYenFormat } from './common_utils.js';

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

function toCurrency(value) {
    return Number(value || 0).toLocaleString();
}

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
    if (elSmallCount) elSmallCount.textContent = `${decks.small_deal ? decks.small_deal.length : 0}`;

    const elBigCount = document.getElementById(DOM_SELECTORS.HOST.DECK_MONITOR.BIG_DEAL_COUNT);
    if (elBigCount) elBigCount.textContent = `${decks.big_deal ? decks.big_deal.length : 0}`;

    const elMarketCount = document.getElementById(DOM_SELECTORS.HOST.DECK_MONITOR.MARKET_COUNT);
    if (elMarketCount) elMarketCount.textContent = `${decks.market ? decks.market.length : 0}`;

    const elDoodadCount = document.getElementById(DOM_SELECTORS.HOST.DECK_MONITOR.DOODAD_COUNT);
    if (elDoodadCount) elDoodadCount.textContent = `${decks.doodad ? decks.doodad.length : 0}`;

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
    
    const tbodyAssetList = document.getElementById('host-asset-list');
    const tbodyFinSummary = document.getElementById('host-financial-summary');
    if (tbodyAssetList) tbodyAssetList.innerHTML = '';
    if (tbodyFinSummary) tbodyFinSummary.innerHTML = '';
    
    for (let i = 0; i < 24; i++) {
        const cell = document.getElementById(`${boardSEL.CELL_PREFIX}${i}`);
        if (cell) cell.innerHTML = '';
    }

    // 場に出ているカードの表示更新
    const elCardInfo = document.getElementById('host-current-card-info');
    const currentCard = state.current_card;
    if (elCardInfo) {
        if (currentCard) {
            elCardInfo.innerHTML = `タイトル: <b>${currentCard.title}</b> &nbsp;&nbsp;&nbsp; asset_type: ${currentCard.asset_type}<br>
            cost: $${toCurrency(currentCard.cost)} &nbsp;&nbsp;&nbsp; down_payment: $${toCurrency(currentCard.down_payment)} &nbsp;&nbsp;&nbsp; mortgage: $${toCurrency(currentCard.mortgage)} &nbsp;&nbsp;&nbsp; passive_income: $${toCurrency(currentCard.passive_income)}`;
        } else {
            elCardInfo.innerHTML = `現在、場に出ているカードはありません。`;
        }
    }

    currentParticipants.forEach((p, idx) => {
        const pState = p.state || {};
        const financials = pState.financials || {};
        const position = pState.position ?? 0;
        const flags = pState.flags || {}; 
        const items = pState.items || [];

        const isCurrentTurn = (p.user_id === currentTurnUserId);
        const displayName = (isCurrentTurn ? '★' : '') + (pState.name || '不明');

        // 1. 参加者基本リスト
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

        // 2. フラグ一覧
        if (flagsListBody) {
            const charityLeft = parseInt(flags.charity_turns_left || 0, 10);
            const downsizedLeft = parseInt(flags.downsized_turns_left || 0, 10);
            const drawnCardTitle = pState.drawn_card ? `🎴 ${pState.drawn_card.title}` : 'なし';

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
                <td style="color: ${pState.drawn_card ? 'red' : 'inherit'}; font-weight: ${pState.drawn_card ? 'bold' : 'normal'};">${drawnCardTitle}</td>
            `;
            flagsListBody.appendChild(trFlags);
        }

        // 3. 財務計算（サマリー用）
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
        
        // 財務サマリー（全員一覧）追加
        if (tbodyFinSummary) {
            const trFin = document.createElement('tr');
            trFin.innerHTML = `
                <td>${displayName}</td>
                <td>$${salary.toLocaleString()}</td>
                <td>$${passiveIncome.toLocaleString()}</td>
                <td>$${totalExpenses.toLocaleString()}</td>
                <td>$${cashflow.toLocaleString()}</td>
                <td>${ftText}</td>
            `;
            tbodyFinSummary.appendChild(trFin);
        }

        // 4. 保有資産一覧用
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
        }).join(' ');
        
        if (tbodyAssetList) {
            const trAsset = document.createElement('tr');
            trAsset.innerHTML = `
                <td>${displayName}</td>
                <td>${assetStrs || 'なし'}</td>
            `;
            tbodyAssetList.appendChild(trAsset);
        }

        // 5. 盤面の更新
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
            fontNode.style.color = 'white';
            fontNode.textContent = displayName;
            
            tdNode.appendChild(fontNode);
            trNode.appendChild(tdNode);
            table.appendChild(trNode);
            targetCell.appendChild(targetCell.firstChild ? document.createElement('br') : document.createDocumentFragment());
            targetCell.appendChild(table);
        }
    });

    // ===============================================
    // プルダウンによる個別財務諸表プレビューの処理
    // ===============================================
    const playerSelect = document.getElementById('player-select');
    if (playerSelect) {
        const currentValue = playerSelect.value;
        playerSelect.innerHTML = '<option value="">プレイヤーを選択</option>';
        
        currentParticipants.forEach(p => {
            if (p.state && p.state.name) {
                const option = document.createElement('option');
                option.value = p.user_id;
                option.textContent = p.state.name + ' の財務諸表';
                playerSelect.appendChild(option);
            }
        });
        
        if (currentValue && currentParticipants.some(p => p.user_id === currentValue)) {
            playerSelect.value = currentValue;
        } else if (currentParticipants.length > 0) {
            playerSelect.value = currentParticipants[0].user_id;
        }

        playerSelect.onchange = () => {
            drawHostScreen();
        };

        const selectedUserId = playerSelect.value;
        const selectedRecord = currentParticipants.find(p => p.user_id === selectedUserId);
        
        if (selectedRecord && selectedRecord.state) {
            const selectedState = selectedRecord.state;
            const selectedFinancials = selectedState.financials || {};
            const selectedItems = selectedState.items || [];
            const selectedName = selectedState.name || "不明";
            
            const elProf = document.getElementById('l-profession');
            if (elProf) elProf.textContent = `${selectedName}の職業：${selectedState.profession || '未定'}`;
            
            const elCash = document.getElementById('l-cash');
            if (elCash) elCash.textContent = `${selectedName}の所持金：${toYenFormat(selectedFinancials.cash)}`;

            let assetsHTML = "<table border='1' width='100%'><tr><th>資産名</th><th>単価</th><th>数量</th><th>CF</th></tr>";
            let liabHTML = "<table border='1' width='100%'><tr><th>負債名</th><th>負債残高</th><th>CF</th></tr>";

            let totalExpenses = 0;
            let passiveIncome = 0;

            selectedItems.forEach(item => {
                const costVal = Number(item.cost || 0);
                const liabVal = Number(item.liability || 0);
                const cfVal = Number(item.cashflow || 0);

                if (cfVal < 0) {
                    totalExpenses += Math.abs(cfVal);
                } else if (cfVal > 0 && costVal > 0) {
                    passiveIncome += cfVal;
                }

                // --- 資産表示 ---
                if (costVal > 0 || (liabVal === 0 && cfVal > 0)) {
                    let cfStr = toYenFormat(cfVal);
                    if (cfStr === "0円") cfStr = "";
                    else if (cfVal > 0) cfStr = `+${cfStr}`;
                    
                    let unitPrice = toYenFormat(costVal);
                    if (unitPrice === "0円") unitPrice = "";

                    const quantity = item.quantity !== undefined ? item.quantity : 1; 
                    const quantityStr = Number(quantity).toLocaleString(); 
                    
                    assetsHTML += `<tr><td>${item.title}</td><td>${unitPrice}</td><td>${quantityStr}</td><td>${cfStr}</td></tr>`;
                }

                // --- 負債表示 ---
                if (liabVal > 0 || (cfVal < 0 && costVal === 0)) {
                    let displayName = item.title;
                    let displayCF = cfVal;
                    
                    if (costVal > 0 && liabVal > 0) {
                        displayName = item.title + "のローン";
                        displayCF = 0; 
                    }

                    let cfStr = toYenFormat(displayCF);
                    if (cfStr === "0円") cfStr = "";
                    else if (displayCF > 0) cfStr = `+${cfStr}`;

                    let liabStr = toYenFormat(liabVal);
                    if (liabStr === "0円") liabStr = "";
                    
                    liabHTML += `<tr><td>${displayName}</td><td>${liabStr}</td><td>${cfStr}</td></tr>`;
                }
            });
            
            assetsHTML += "</table>";
            liabHTML += "</table>";

            const elProfit = document.getElementById('l-profit');
            if (elProfit) elProfit.innerHTML = assetsHTML;

            const elLoss = document.getElementById('l-loss');
            if (elLoss) elLoss.innerHTML = liabHTML;

            const btnFastTrack = document.getElementById('fast_track');
            if (btnFastTrack) {
                const diffToFastTrack = totalExpenses - passiveIncome;
                if (diffToFastTrack > 0) {
                    btnFastTrack.textContent = `ファーストトラックまで、あと${toYenFormat(diffToFastTrack)}`;
                } else {
                    btnFastTrack.textContent = `ファーストトラックへ移行可能！`;
                }
            }
        }
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
