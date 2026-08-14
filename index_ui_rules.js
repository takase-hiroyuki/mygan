// index_ui_rules.js
import { SEL_G } from './common_dom_selectors.js'; 
import { setButtonActive, setMultipleButtonsActive, CELLS_OPPORTUNITY, CELLS_DOODAD, CELLS_MARKET, toYenFormat } from './common_utils.js';

export function applyUIRules(currentUserId, cachedParticipants, cachedRoom) {
    const record = cachedParticipants.find(p => p.user_id === currentUserId);
    if (!record || !record.state) return;

    const state = record.state;
    const financials = state.financials || {};
    const flags = state.flags || {}; 
    const items = state.items || []; 
    
    let hasBankLoan = items.some(item => item.asset_type === 'BankLoan'); 
    let cash = Number(financials.cash || 0);

    const turnUserId = cachedRoom ? cachedRoom.current_turn_user_id : null;
    const isMyTurn = (turnUserId === currentUserId);
    const isPlaying = cachedRoom?.game_state?.status === 'playing';

    const diceStatusArea = document.getElementById(SEL_G.CONTROLS.DICE_USER);
    
    const safeUpdate = (selectorId, text) => {
        const el = document.getElementById(selectorId);
        if (el) el.textContent = text;
    };

    const updateCardDisplay = (html) => {
        const el = document.getElementById(SEL_G.TRADE.THIS_CARD);
        if (el) el.innerHTML = html;
    };

    const turnUserRecord = cachedParticipants.find(p => p.user_id === turnUserId);
    const turnUserState = turnUserRecord ? turnUserRecord.state : {};
    const turnUserFlags = turnUserState.flags || {};

    const activeCard = state.drawn_card || cachedRoom?.game_state?.current_card || null;
    const iAmCardHolder = !!state.drawn_card;

    const elNumProcess = document.getElementById(SEL_G.TRADE.NUM_PROCESS_SELF);
    const elSellTarget = document.getElementById(SEL_G.TRADE.SELECT_TARGET);
    const elSellPrice = document.getElementById(SEL_G.TRADE.INPUT_PRICE);

    const isTurnUserOnCharity = [3, 16].includes(parseInt(turnUserState.position, 10));

    if (activeCard) {
        let cardHTML = `【${activeCard.title}】<br>`;
        
        let descText = activeCard.description_jp2 || activeCard.description_jp || activeCard.description || '';
        cardHTML += `${descText}<br>`;
        
        if (activeCard.cost > 0) {
            let costStr = toYenFormat(activeCard.cost);
            cardHTML += `<br>価格: ${costStr}`;

            if (activeCard.down_payment > 0 && activeCard.down_payment !== activeCard.cost) {
                let dpStr = toYenFormat(activeCard.down_payment);
                cardHTML += ` (頭金: ${dpStr})`;
            }
        }
        if (activeCard.passive_income !== 0 && activeCard.passive_income !== null && activeCard.passive_income !== undefined) {
            let piStr = toYenFormat(activeCard.passive_income);
            cardHTML += `<br>キャッシュフロー: ${piStr}`;
        }
        
        updateCardDisplay(cardHTML);
        
        if (elNumProcess) {
            const qtyRequiredTypes = ['MYT4U', 'OK4U', 'ON2U', '2BIG', 'GR4US', '10pGold', '8pGold'];
            elNumProcess.hidden = !qtyRequiredTypes.includes(activeCard.asset_type);
            
            if (!elNumProcess.hidden && (!elNumProcess.value || parseInt(elNumProcess.value, 10) < 1)) {
                elNumProcess.value = 1;
            }
        }

        let canPass = false;
        let canProcess = false;

        if (activeCard.deck_type === 'doodad') {
            canProcess = true;
            canPass = false; 
        } else if (activeCard.deck_type === 'market') {
            canProcess = false; 
            canPass = true;
        } else {
            if (activeCard.asset_type === 'other') {
                canProcess = true;
                canPass = false; 
            } else {
                canProcess = true;
                canPass = true; 
            }
        }
        
        if (iAmCardHolder) {
            setButtonActive(SEL_G.TRADE.BTN_SELL, activeCard.asset_type !== 'other' && !!activeCard.is_resellable);
            setButtonActive(SEL_G.TRADE.BTN_PROCESS_SELF, canProcess);
            setButtonActive(SEL_G.TRADE.BTN_PASS_CARD, canPass);
            if (elSellTarget) elSellTarget.disabled = activeCard.asset_type === 'other' || !activeCard.is_resellable;
            if (elSellPrice) elSellPrice.disabled = activeCard.asset_type === 'other' || !activeCard.is_resellable;
        } else {
            setButtonActive(SEL_G.TRADE.BTN_SELL, false);
            setButtonActive(SEL_G.TRADE.BTN_PROCESS_SELF, false);
            setButtonActive(SEL_G.TRADE.BTN_PASS_CARD, false);
            if (elSellTarget) elSellTarget.disabled = true;
            if (elSellPrice) elSellPrice.disabled = true;
        }
        
        setButtonActive(SEL_G.CARD.BTN_SMALL_DEAL, false);
        setButtonActive(SEL_G.CARD.BTN_BIG_DEAL, false);

    } else if (turnUserFlags.has_rolled_dice && isTurnUserOnCharity && !turnUserFlags.is_action_completed) {
        if (isMyTurn) {
            const totalIncome = items.filter(i => (i.cashflow || 0) > 0).reduce((sum, i) => sum + Number(i.cashflow), 0);
            const donateAmount = totalIncome * 0.1;
            
            const donateStr = toYenFormat(donateAmount);

            updateCardDisplay(`【寄付】<br>総収入の10% (${donateStr}) を支払うことで、以降3ターンの間サイコロを2個振ることができます。`);
            
            setButtonActive(SEL_G.TRADE.BTN_PROCESS_SELF, true);
            setButtonActive(SEL_G.TRADE.BTN_PASS_CARD, true);
        } else {
            updateCardDisplay(`${turnUserState.name || '他のプレイヤー'} が寄付を検討中です...`);
            setButtonActive(SEL_G.TRADE.BTN_PROCESS_SELF, false);
            setButtonActive(SEL_G.TRADE.BTN_PASS_CARD, false);
        }
        if (elNumProcess) elNumProcess.hidden = true;
        if (elSellTarget) elSellTarget.disabled = true;
        if (elSellPrice) elSellPrice.disabled = true;
        setButtonActive(SEL_G.CARD.BTN_SMALL_DEAL, false);
        setButtonActive(SEL_G.CARD.BTN_BIG_DEAL, false);
        setButtonActive(SEL_G.TRADE.BTN_SELL, false);

    } else if (turnUserFlags.has_rolled_dice && CELLS_OPPORTUNITY.includes(parseInt(turnUserState.position, 10)) && !turnUserFlags.is_card_drawn) {
        if (isMyTurn) {
            const myName = turnUserState.name || 'あなた';
            updateCardDisplay(`${myName}は、普通の商売、または大きな商売、のどちらかをひいてください`);
            setButtonActive(SEL_G.CARD.BTN_SMALL_DEAL, true);
            setButtonActive(SEL_G.CARD.BTN_BIG_DEAL, true);
        } else {
            updateCardDisplay(`${turnUserState.name || '他のプレイヤー'} が商売カードを選択中です...`);
            setButtonActive(SEL_G.CARD.BTN_SMALL_DEAL, false);
            setButtonActive(SEL_G.CARD.BTN_BIG_DEAL, false);
        }
        setButtonActive(SEL_G.TRADE.BTN_SELL, false);
        setButtonActive(SEL_G.TRADE.BTN_PROCESS_SELF, false);
        setButtonActive(SEL_G.TRADE.BTN_PASS_CARD, false);
        
        if (elNumProcess) elNumProcess.hidden = true;
        if (elSellTarget) elSellTarget.disabled = true;
        if (elSellPrice) elSellPrice.disabled = true;
    } else {
        updateCardDisplay("あなたの手番を待つか、サイコロを振ってください。");
        setButtonActive(SEL_G.TRADE.BTN_SELL, false);
        setButtonActive(SEL_G.TRADE.BTN_PROCESS_SELF, false);
        setButtonActive(SEL_G.TRADE.BTN_PASS_CARD, false);
        setButtonActive(SEL_G.CARD.BTN_SMALL_DEAL, false);
        setButtonActive(SEL_G.CARD.BTN_BIG_DEAL, false);
        
        if (elNumProcess) elNumProcess.hidden = true;
        if (elSellTarget) elSellTarget.disabled = true;
        if (elSellPrice) elSellPrice.disabled = true;
    }
    
    if (!isPlaying) {
        if (diceStatusArea) diceStatusArea.textContent = "ホストがゲームを開始するまでお待ちください。";
        setButtonActive(SEL_G.LOAN.BTN_BORROW_LOAN, false);
        setButtonActive(SEL_G.LOAN.BTN_PAYBACK_LOAN, false);
        setButtonActive(SEL_G.FINANCIALS.BTN_OPERATE, false);
    } else {
        const turnUserName = turnUserRecord ? turnUserRecord.state.name : "他のプレイヤー";        

        if (isMyTurn) {
            const pendingPaydays = parseInt(flags.pending_paydays || 0, 10);
            setButtonActive(SEL_G.CONTROLS.BTN_PAYCHECK, pendingPaydays > 0);

            if (flags.has_rolled_dice) {
                if (diceStatusArea) {
                    diceStatusArea.textContent = pendingPaydays > 0 
                        ? `結果:【${state.last_dice}】 入金請求（${pendingPaydays}回分）`
                        : `結果:【${state.last_dice}】`;
                }
                
                setButtonActive(SEL_G.CONTROLS.BTN_DICE1, false);
                setButtonActive(SEL_G.CONTROLS.BTN_DICE_2, false);
                
                let canEndTurn = false;
                const isTrading = !!cachedRoom?.game_state?.trade_offer;
                const anyCardHolderExists = cachedParticipants.some(p => p.state && p.state.drawn_card);
                
                const hasInstantDebt = items.some(item => item.asset_type === 'InstantDebt');
                
                const posNum = parseInt(state.position, 10);
                const isMyCharity = [3, 16].includes(posNum);
                const isCardCell = CELLS_OPPORTUNITY.includes(posNum) || CELLS_MARKET.includes(posNum) || CELLS_DOODAD.includes(posNum);
                
                if (!flags.is_calculating && financials.cash >= 0) {
                    if (!anyCardHolderExists && !isTrading && !hasInstantDebt) {
                        if (isMyCharity || isCardCell) {
                            if (flags.is_action_completed) {
                                canEndTurn = true;
                            }
                        } else {
                            canEndTurn = true;
                        }
                    }
                }
                
                setButtonActive(SEL_G.CONTROLS.BTN_END_TURN, canEndTurn);

            } else {
                const charityTurnsLeft = parseInt(flags.charity_turns_left || 0, 10);
                const downsizedTurnsLeft = parseInt(flags.downsized_turns_left || 0, 10);

                if (downsizedTurnsLeft > 0) {
                    if (diceStatusArea) diceStatusArea.textContent = `休み（残り ${downsizedTurnsLeft} ターン）`;
                    setButtonActive(SEL_G.CONTROLS.BTN_DICE1, false);
                    setButtonActive(SEL_G.CONTROLS.BTN_DICE_2, false);
                    
                    const hasInstantDebt = items.some(item => item.asset_type === 'InstantDebt');
                    
                    setButtonActive(SEL_G.CONTROLS.BTN_END_TURN, !hasInstantDebt);
                } else {
                    if (diceStatusArea) diceStatusArea.textContent = charityTurnsLeft > 0 
                        ? `あなたの手番 (寄付効果: 残り ${charityTurnsLeft} ターン)` 
                        : "あなたの手番";
                        
                    setButtonActive(SEL_G.CONTROLS.BTN_DICE1, true);
                    setButtonActive(SEL_G.CONTROLS.BTN_DICE_2, charityTurnsLeft > 0);
                    setButtonActive(SEL_G.CONTROLS.BTN_END_TURN, false);
                }
                
                setButtonActive(SEL_G.FINANCIALS.BTN_C_CASHFLOW, !!flags.is_calculating);
            }
        } else {
            if (diceStatusArea) diceStatusArea.textContent = `[${turnUserName}] がプレイ中`;
            
            setMultipleButtonsActive([
                SEL_G.CONTROLS.BTN_DICE1, SEL_G.CONTROLS.BTN_DICE_2, SEL_G.CONTROLS.BTN_PAYCHECK, SEL_G.CONTROLS.BTN_END_TURN,
                SEL_G.CARD.BTN_SMALL_DEAL, SEL_G.CARD.BTN_BIG_DEAL,
                SEL_G.FINANCIALS.BTN_C_CASHFLOW
            ], false);
        }

        // ゲームプレイ中であれば常に借入可能
        setButtonActive(SEL_G.LOAN.BTN_BORROW_LOAN, true);
        
        // 現金が1,000ドル以上かつ銀行ローンがある場合のみ返済可能
        setButtonActive(SEL_G.LOAN.BTN_PAYBACK_LOAN, hasBankLoan && cash >= 1000); 
        
        // その他の資産売却・負債返済メニュー
        setButtonActive(SEL_G.FINANCIALS.BTN_OPERATE, true);
    }

    const tradeOffer = cachedRoom?.game_state?.trade_offer;
    
    const otherCardHolders = cachedParticipants.filter(p => p.user_id !== currentUserId && p.state && p.state.drawn_card);

    if (tradeOffer) {
        if (tradeOffer.to === currentUserId) {
            const fromUser = cachedParticipants.find(p => p.user_id === tradeOffer.from);
            const offerStr = toYenFormat(tradeOffer.price);
            safeUpdate(SEL_G.TRADE.TRADE_MESSAGE, `${fromUser?.state?.name || "他のプレイヤー"} さんから ${offerStr} で権利を買う提案が来ています。`);
            setButtonActive(SEL_G.TRADE.BTN_ACCEPT, true);
            setButtonActive(SEL_G.TRADE.BTN_REJECT, true);
        } else if (tradeOffer.from === currentUserId) {
            const toUser = cachedParticipants.find(p => p.user_id === tradeOffer.to);
            safeUpdate(SEL_G.TRADE.TRADE_MESSAGE, `${toUser?.state?.name || "他のプレイヤー"} さんからの返答を待っています...`);
            setButtonActive(SEL_G.TRADE.BTN_ACCEPT, false);
            setButtonActive(SEL_G.TRADE.BTN_REJECT, false);
        } else {
            safeUpdate(SEL_G.TRADE.TRADE_MESSAGE, "他プレイヤー間で交渉中です...");
            setButtonActive(SEL_G.TRADE.BTN_ACCEPT, false);
            setButtonActive(SEL_G.TRADE.BTN_REJECT, false);
        }
    } else if (otherCardHolders.length > 0) {
        const holderNames = otherCardHolders.map(p => p.state?.name || "他のプレイヤー").join('、');
        safeUpdate(SEL_G.TRADE.TRADE_MESSAGE, `⚠️ 処理待ち: ${holderNames} さんがカードを所持（未処理）しています。`);
        setButtonActive(SEL_G.TRADE.BTN_ACCEPT, false);
        setButtonActive(SEL_G.TRADE.BTN_REJECT, false);
    } else {
        safeUpdate(SEL_G.TRADE.TRADE_MESSAGE, "受け取るメッセージ (現在交渉なし)");
        setButtonActive(SEL_G.TRADE.BTN_ACCEPT, false);
        setButtonActive(SEL_G.TRADE.BTN_REJECT, false);
    }
}

console.log("【残す】index_ui_rules.js が読み込まれました。");
