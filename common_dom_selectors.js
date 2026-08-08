// common_dom_selectors.js

/**
 * My Game - DOMセレクター定数定義ファイル
 */

export const DOM_SELECTORS = {
    // =========================================================================
    // 1. ゲスト画面 (index.html) 用のID定義
    // =========================================================================
    GUEST: {
        // プレイヤー登録（ログイン）エリア
        LOGIN: {
            SECTION: 'section-login',
            INPUT_USERNAME: 'input-username',
            BTN_LOGIN: 'btn-login'
        },

        // システムメッセージ表示エリア
        MESSAGE: {
            BODY: 'message-body'
        },

        // あなたのステータス表示エリア
        STATUS: {
            SECTION: 'section-guest',
            NAME: 'g-name',
            CHILDREN_COUNT: 'g-child-count',
            PER_CHILD_EXPENSE: 'g-child-expense',
            PROFESSION: 'g-profession',
            CURRENT_CASH: 'current-cash'
        },

        // 手番・サイコロ制御エリア
        CONTROLS: {
            DICE_RESULT: 'dice-result',
            DICE_USER: 'dice-user', 
            BTN_DICE1: 'btn-dice1',
            BTN_DICE_2: 'btn-dice2',
            BTN_END_TURN: 'btn-end-turn',
            BTN_PAYCHECK: 'btn-paycheck'
        },

        // カードドローエリア
        CARD: {
            BTN_SMALL_DEAL: 'btn-small-deal',    
            BTN_BIG_DEAL: 'btn-big-deal'
        },

        // 他プレイヤーとの取引（トレード）エリア
        TRADE: {
            THIS_CARD: 'thiscard',
            SELECT_TARGET: 'sell-target',
            INPUT_PRICE: 'sell-price',
            BTN_SELL: 'btn-sell-card',
            TRADE_MESSAGE: 'trade-message',
            BTN_ACCEPT: 'btn-trade-accept',
            BTN_REJECT: 'btn-trade-reject'
        },

        // 銀行ローン操作
        LOAN: {
            BTN_BORROW_LOAN: 'btn-borrow-loan',            
            BTN_PAYBACK_LOAN: 'btn-payback-loan'
        },

        // ゲスト用すごろく盤面モニターID生成用のプレフィックス
        BOARD: {
            RAT_PREFIX: 'cell-'
        },

        // 財務諸表・資産負債手動計算・操作エリア
        FINANCIALS: {
            PLAYER_SELECT: 'player-select',
            D_PROFESSION: 'l-profession',   // ★追加: 選択された人の職業
            D_CASH: 'l-cash',               // ★追加: 選択された人の現金
            D_PROFIT: 'l-profit',
            D_LOSS: 'l-loss',
            D_CASHFLOW: 'ncashflow', 
            INPUT_CASHFLOW: 'icashflow',
            BTN_C_CASHFLOW: 'bcashflow',
            PROFIT_LOSS_SELECT: 'profit_loss',
            PL_OPERATE_SELECT: 'pl-operate',
            BTN_OPERATE: 'b-operate'
        }
    },

    // =========================================================================
    // 2. ホスト画面 (host.html) 用のID定義
    // =========================================================================
    HOST: {
        SECTION: 'section-host',
        
        // 部屋ステータス管理・ライフサイクル制御エリア
        LIFECYCLE: {
            DISPLAY_ROOM_STATUS: 'host-room-status',             
            BTN_INITIAL_SHUFFLE: 'btn-initial-shuffle-start',     
            BTN_FORCE_GAME_END: 'btn-force-game-end'              
        },

        // 4種類の山札および使用済みカードの残り枚数監視モニター
        DECK_MONITOR: {
            SMALL_DEAL_COUNT: 'deck-count-small-deal',
            BIG_DEAL_COUNT: 'deck-count-big-deal',
            MARKET_COUNT: 'deck-count-market',
            DOODAD_COUNT: 'deck-count-doodad',
            BTN_RESHUFFLE_SMALL_DEAL: 'btn-reshuffle-small-deal',
            BTN_RESHUFFLE_BIG_DEAL: 'btn-reshuffle-big-deal',
            BTN_RESHUFFLE_MARKET: 'btn-reshuffle-market',
            BTN_RESHUFFLE_DOODAD: 'btn-reshuffle-doodad'
        },

        // サイコロ監視エリア
        DICE_MONITOR: 'host-dice-monitor',

        // 手番プレイヤー手動制御エリア
        TURN_CONTROL: {
            INPUT_NEXT_ORDER: 'input-next-turn-order',
            BTN_SET_TURN: 'btn-set-turn'
        },

        // 退室管理エリア
        KICK_CONTROL: {
            INPUT_KICK_ORDER: 'input-kick-order',
            BTN_KICK_PARTICIPANT: 'btn-kick-participant'
        },

        // 参加者名簿テーブル関連
        PARTICIPANT_LIST: 'host-participant-list',
        PARTICIPANT_ITEM: {
            ROW_CLASS: 'host-participant-row',
            PROFESSION_CLASS: 'host-participant-profession' 
        },

        // プレイヤーフラグ監視用テーブル
        FLAGS_LIST: 'host-flags-list',

        // ホスト用盤面モニターID生成用のプレフィックス
        BOARD: {
            CELL_PREFIX: 'rat-cell-'
        }
    }
};

export const SEL_G = DOM_SELECTORS.GUEST;
export const SEL_H = DOM_SELECTORS.HOST;

console.log("【デバッグ】common_dom_selectors.js が読み込まれました。");
