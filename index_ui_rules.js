// index_ui_rules.js
import { SEL_G } from './common_dom_selectors.js'; 
import { setButtonActive, setMultipleButtonsActive, CELLS_OPPORTUNITY, CELLS_DOODAD, CELLS_MARKET } from './common_utils.js';

function toCurrency(value) {
    return Number(value || 0).toLocaleString();
}

export function applyUIRules(currentUserId, cachedParticipants, cachedRoom) {
    const record = cachedParticipants.find(p => p.user_id === currentUserId);
    if (!record || !record.state) return;

    const state = record.state;
    const financials = state.financials || {};
    const flags = state.flags || {}; 
    const items = state.items || []; // ★ 共通化: アイテム一覧の取得
    const hasBankLoan = items.some(item => item.type_id === 'BankLoan'); // ★ 追加: 銀行ローンの有無を判定

    const turnUserId = cachedRoom ? cachedRoom.current_turn_user_id : null;
    const isMyTurn = (turnUserId === currentUserId);
    const isPlaying = cachedRoom?.game_state?.status === 'playing';

    const diceStatusArea = document.getElementById(SEL_G.CONTROLS.DICE_USER);
    
    const safeUpdate = (selectorId, text) => {
        const el = document.getElementById(selectorId);
        if (el) el.textContent = text;
    };

    const turnUserRecord = cachedParticipants.find(p => p.user_id === turnUserId);
    const turnUserState = turnUserRecord ? turnUserRecord.state : {};
    const turnUserFlags = turnUserState.flags || {};

    const cardHolderRecord = cachedParticipants.find(p => p.state && p.state.drawn_card);
    const activeCard = cardHolderRecord ? cardHolderRecord.state.drawn_card : null;
    const cardHolderId = cardHolderRecord ? cardHolderRecord.user_id : null;
    const iAmCardHolder = (cardHolderId === currentUserId);

    const elNumProcess = document.getElementById(SEL_G.TRADE.NUM_PROCESS_SELF);
    const elBtnProcess = document.getElementById(SEL_G.TRADE.BTN_PROCESS_SELF);
    const elBtnPass = document.getElementById(SEL_G.TRADE.BTN_PASS_CARD);
    const elSellTarget = document.getElementById(SEL_G.TRADE.SELECT_TARGET);
    const elSellPrice = document.getElementById(SEL_G.TRADE.INPUT_PRICE);

    const isTurnUserOnCharity = [3, 16].includes(parseInt(turnUserState.position, 10));

    if (activeCard) {
        let cardText = `【${activeCard.title}】\n${activeCard.description_jp || activeCard.description || ''}\n`;
        
        if (activeCard.cost > 0) {
            cardText += `\n価格: $${toCurrency(activeCard.cost)}`;
            if (activeCard.down_payment > 0 && activeCard.down_payment !== activeCard.cost) {
                cardText += ` (頭金: $${toCurrency(activeCard.down_payment)})`;
            }
        }
        if (activeCard.passive_income !== 0 && activeCard.passive_income !== null && activeCard.passive_income !== undefined) {
            cardText += `\nキャッシュフロー: $${toCurrency(activeCard.passive_income)}`;
        }
        
        safeUpdate(SEL_G.TRADE.THIS_CARD, cardText);
        
        if (elNumProcess) {
            const qtyRequiredTypes = ['MYT4U', 'OK4U', 'ON2U', '2BIG', 'GR4US', '10pGold', '8pGold'];
            elNumProcess.hidden = !qtyRequiredTypes.includes(activeCard.asset_type);
            
            if (!elNumProcess.hidden && (!elNumProcess.value || parseInt(elNumProcess.value, 10) < 1)) {
                elNumProcess.value = 1;
            }
        }

        let canPass = false;
        let canProcess = false;

        // ★修正: deck_type を最優先にした堅牢な判定ロジックに変更
        if (elBtnProcess && elBtnPass) {
            if (activeCard.deck_type === 'doodad') {
                // パターン1: Doodad（無駄遣い） -> 強制支払い
                elBtnProcess.textContent = '支払う';
                elBtnPass.textContent = '見送る（パスする）'; 
                canProcess = true;
                canPass = false; 
            } else if (activeCard.deck_type === 'market') {
                // パターン2: Market（市場） -> この場での購入・支払いはなし（手番を進めるだけ）
                elBtnProcess.textContent = '実行する'; 
                elBtnPass.textContent = '確認して手番を進める';
                canProcess = false; 
                canPass = true;
            } else {
                // パターン3, 4: Small Deal / Big Deal
                if (activeCard.asset_type === 'other') {
                    // 特殊イベント（増資・減資・損害など） -> 強制適用
                    elBtnProcess.textContent = '実行する（適用）';
                    elBtnPass.textContent = 'パスする';
                    canProcess = true;
                    canPass = false; 
                } else {
                    // 通常の商売（株、不動産など） -> 任意購入
                    elBtnProcess.textContent = '購入する';
                    elBtnPass.textContent = 'パスする';
                    canProcess = true;
                    canPass = true; 
                }
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
            
            safeUpdate(SEL_G.TRADE.THIS_CARD, `【寄付】\n総収入の10% ($${toCurrency(donateAmount)}) を支払うことで、以降3ターンの間サイコロを2個振ることができます。`);
            
            setButtonActive(SEL_G.TRADE.BTN_PROCESS_SELF, true);
            setButtonActive(SEL_G.TRADE.BTN_PASS_CARD, true);
            if (elBtnProcess) elBtnProcess.textContent = '寄付する';
            if (elBtnPass) elBtnPass.textContent = '見送る（パスする）';
        } else {
            safeUpdate(SEL_G.TRADE.THIS_CARD, `${turnUserState.name || '他のプレイヤー'} が寄付を検討中です...`);
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
            safeUpdate(SEL_G.TRADE.THIS_CARD, "普通の商売、または大きな商売、のどちらかをひいてください");
            setButtonActive(SEL_G.CARD.BTN_SMALL_DEAL, true);
            setButtonActive(SEL_G.CARD.BTN_BIG_DEAL, true);
        } else {
            safeUpdate(SEL_G.TRADE.THIS_CARD, `${turnUserState.name || '他のプレイヤー'} が商売カードを選択中です...`);
            setButtonActive(SEL_G.CARD.BTN_SMALL_DEAL, false);
            setButtonActive(SEL_G.CARD.BTN_BIG_DEAL, false);
        }
        setButtonActive(SEL_G.TRADE.BTN_SELL, false);
        setButtonActive(SEL_G.TRADE.BTN_PROCESS_SELF, false);
        setButtonActive(SEL_G.TRADE.BTN_PASS_CARD, false);
        
        if (elNumProcess) elNumProcess.hidden = true;
        if (elSellTarget) elSellTarget.disabled = true;
        if (elSellPrice) elSellPrice.disabled = true;
        if (elBtnProcess) elBtnProcess.textContent = '購入する・支払う';
        if (elBtnPass) elBtnPass.textContent = '見送る（パスする）';
    } else {
        safeUpdate(SEL_G.TRADE.THIS_CARD, "あなたの手番を待つか、サイコロを振ってください。");
        setButtonActive(SEL_G.TRADE.BTN_SELL, false);
        setButtonActive(SEL_G.TRADE.BTN_PROCESS_SELF, false);
        setButtonActive(SEL_G.TRADE.BTN_PASS_CARD, false);
        setButtonActive(SEL_G.CARD.BTN_SMALL_DEAL, false);
        setButtonActive(SEL_G.CARD.BTN_BIG_DEAL, false);
        
        if (elNumProcess) elNumProcess.hidden = true;
        if (elSellTarget) elSellTarget.disabled = true;
        if (elSellPrice) elSellPrice.disabled = true;
        if (elBtnProcess) elBtnProcess.textContent = '購入する・支払う';
        if (elBtnPass) elBtnPass.textContent = '見送る（パスする）';
    }
    
    if (!isPlaying) {
        if (diceStatusArea) diceStatusArea.textContent = "ホストがゲームを開始するまでお待ちください。";
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
                
                const hasInstantDebt = items.some(item => item.type_id === 'InstantDebt');
                
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
                    
                    const hasInstantDebt = items.some(item => item.type_id === 'InstantDebt');
                    
                    setButtonActive(SEL_G.CONTROLS.BTN_END_TURN, !hasInstantDebt);
                } else {
                    if (diceStatusArea) diceStatusArea.textContent = charityTurnsLeft > 0 
                        ? `あなたの手番 (寄付効果: 残り ${charityTurnsLeft} ターン)` 
                        : "あなたの手番";
                        
                    setButtonActive(SEL_G.CONTROLS.BTN_DICE1, true);
                    setButtonActive(SEL_G.CONTROLS.BTN_DICE_2, charityTurnsLeft > 0);
                    setButtonActive(SEL_G.CONTROLS.BTN_END_TURN, false);
                }
            }
            
            setButtonActive(SEL_G.FINANCIALS.BTN_C_CASHFLOW, !!flags.is_calculating);
            setButtonActive(SEL_G.LOAN.BTN_BORROW_LOAN, true);
            setButtonActive(SEL_G.LOAN.BTN_PAYBACK_LOAN, hasBankLoan); 
            setButtonActive(SEL_G.FINANCIALS.BTN_OPERATE, true);
            
        } else {
            if (diceStatusArea) diceStatusArea.textContent = `[${turnUserName}] がプレイ中`;
            
            setMultipleButtonsActive([
                SEL_G.CONTROLS.BTN_DICE1, SEL_G.CONTROLS.BTN_DICE_2, SEL_G.CONTROLS.BTN_PAYCHECK, SEL_G.CONTROLS.BTN_END_TURN,
                SEL_G.CARD.BTN_SMALL_DEAL, SEL_G.CARD.BTN_BIG_DEAL,
                SEL_G.FINANCIALS.BTN_C_CASHFLOW
            ], false);

            setButtonActive(SEL_G.LOAN.BTN_BORROW_LOAN, true);
            setButtonActive(SEL_G.LOAN.BTN_PAYBACK_LOAN, hasBankLoan); 
            setButtonActive(SEL_G.FINANCIALS.BTN_OPERATE, true);
        }
    }

    const tradeOffer = cachedRoom?.game_state?.trade_offer;
    if (tradeOffer) {
        if (tradeOffer.to === currentUserId) {
            const fromUser = cachedParticipants.find(p => p.user_id === tradeOffer.from);
            safeUpdate(SEL_G.TRADE.TRADE_MESSAGE, `${fromUser?.state?.name || "他のプレイヤー"} さんから $${toCurrency(tradeOffer.price)} で権利を買う提案が来ています。`);
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
    } else {
        safeUpdate(SEL_G.TRADE.TRADE_MESSAGE, "受け取るメッセージ (現在交渉なし)");
        setButtonActive(SEL_G.TRADE.BTN_ACCEPT, false);
        setButtonActive(SEL_G.TRADE.BTN_REJECT, false);
    }
}

console.log("【残す】index_ui_rules.js が読み込まれました。");
