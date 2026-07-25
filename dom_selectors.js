// dom_selectors.js

/**
 * My Game - DOMセレクター定数定義ファイル
 * host.html および index.html (guest) 内のすべての静的HTML要素のIDを一括管理します。
 */

export const DOM_SELECTORS = {
    // =========================================================================
    // 1. ゲスト画面 (index.html) 用のID定義
    // =========================================================================
    GUEST: {
        // ブラウザの記憶状態エリア
        DEBUG: {
            STORAGE_ID: 'debug-storage-id',
            STORAGE_NAME: 'debug-storage-name'
        },

        // プレイヤー登録（ログイン）エリア
        LOGIN: {
            SECTION: 'section-login',
            INPUT_USERNAME: 'input-username',
            BTN_LOGIN: 'btn-login'
        },

        // あなたのステータス表示エリア
        STATUS: {
            SECTION: 'section-guest',
            ROOM_ID: 'guest-room-id',
            NAME: 'guest-name',
            DISPLAY_CURRENT_CASH: 'display-current-cash', 
            ROLE: 'guest-role',
            PROFESSION: 'guest-profession'
        },

        // 手番・サイコロ制御エリア
        CONTROLS: {
            STATUS_AREA: 'dice-status-area',
            DICE_RESULT: 'guest-dice-result',
            BTN_ROLL_DICE: 'btn-roll-dice',
            BTN_CLAIM_PAYCHECK: 'btn-claim-paycheck', 
            BTN_END_TURN: 'btn-end-turn',              
            BTN_ESCAPE_RAT_RACE: 'btn-escape-rat-race' 
        },

        // カードドロー・取引エリア
        CARD: {
            CONTAINER: 'card-display-container',
            LEGEND: 'display-card-legend',                 
            STATUS_MESSAGE: 'card-status-message',         
            NUMERICAL_DETAILS_CONTAINER: 'card-numerical-details', 
            DETAIL_COST: 'card-detail-cost',               
            DETAIL_DOWNPAYMENT: 'card-detail-downpayment', 
            DETAIL_CASHFLOW: 'card-detail-cashflow',       
            DRAW_OPTIONS_CONTAINER: 'deck-draw-options',   
            BTN_DRAW_SMALL_DEAL: 'btn-draw-small-deal',    
            BTN_DRAW_BIG_DEAL: 'btn-draw-big-deal',        
            BTN_DRAW_MARKET: 'btn-draw-market',            
            BTN_DRAW_DOODAD: 'btn-draw-doodad',            
            OPTIONS_CONTAINER: 'card-action-options',   
            BTN_BUY_REALESTATE: 'btn-card-buy-realestate', 
            BTN_BUY_STOCK: 'btn-card-buy-stock',           
            BTN_SELL_STOCK: 'btn-card-sell-stock',         
            BTN_PAY_DOODAD: 'btn-card-pay-doodad',         
            BTN_PASS: 'btn-card-pass'                      
        },

        // 財務諸表（PL/BS）手動計算エリア
        FINANCIALS: {
            CONTAINER: 'financials-container',
            CALC_PHASE_NAME: 'calc-phase-name',
            CALC_LOCK_STATUS: 'calc-lock-status',
            DISPLAY_SALARY: 'display-salary',
            DISPLAY_PASSIVE_INCOME: 'display-passive-income',
            DISPLAY_TOTAL_INCOME: 'display-total-income', 
            INPUT_TOTAL_INCOME: 'input-total-income',
            DISPLAY_TOTAL_EXPENSES: 'display-total-expenses',
            DISPLAY_MONTHLY_CASHFLOW: 'display-monthly-cashflow', 
            INPUT_NET_CASHFLOW: 'input-net-cashflow',
            BTN_CHECK_CALCULATIONS: 'btn-check-calculations'
        },

        // 資産・負債状況エリア (ポートフォリオ)
        PORTFOLIO: {
            CONTAINER: 'portfolio-container',
            STOCKS: 'display-portfolio-stocks',
            REAL_ESTATE: 'display-portfolio-realestate',
            LIABILITY_MORTGAGE: 'display-liability-mortgage',
            LIABILITY_CAR_LOAN: 'display-liability-carloan',
            LIABILITY_RETAIL: 'display-liability-retail',
            LOAN_CONTROL_CONTAINER: 'bank-loan-control',  
            BTN_BORROW_LOAN: 'btn-borrow-loan',            
            BTN_PAYBACK_LOAN: 'btn-payback-loan',          
            DISPLAY_LIABILITY_BANKLOAN: 'display-liability-bankloan',   
            DISPLAY_EXPENSE_LOANINTEREST: 'display-expense-loaninterest' 
        },

        // ゲスト用すごろく盤面モニターID生成用のプレフィックス
        BOARD: {
            RAT_PREFIX: 'rat-cell-', 
            FAST_PREFIX: 'fast-cell-' 
        }
    },

    // =========================================================================
    // 2. ホスト画面 (host.html) 用のID定義
    // =========================================================================
    HOST: {
        SECTION: 'section-host',
        
        // 🌟部屋ステータス管理・ライフサイクル制御エリア
        LIFECYCLE: {
            DISPLAY_ROOM_STATUS: 'host-room-status',              
            BTN_INITIAL_SHUFFLE: 'btn-initial-shuffle-start',     
            BTN_FORCE_GAME_END: 'btn-force-game-end',             
            BTN_INITIALIZE_ROOM: 'btn-initialize-room'            
        },

        // 🌟4種類の山札および使用済みカードの残り枚数監視モニター
        DECK_MONITOR: {
            SMALL_DEAL_COUNT: 'deck-count-small-deal',
            BIG_DEAL_COUNT: 'deck-count-big-deal',
            MARKET_COUNT: 'deck-count-market',
            DOODAD_COUNT: 'deck-count-doodad',
            // 🌟デッキ個別の手動リシャッフルボタン用
            BTN_RESHUFFLE_SMALL_DEAL: 'btn-reshuffle-small-deal',
            BTN_RESHUFFLE_BIG_DEAL: 'btn-reshuffle-big-deal',
            BTN_RESHUFFLE_MARKET: 'btn-reshuffle-market',
            BTN_RESHUFFLE_DOODAD: 'btn-reshuffle-doodad'
        },

        // サイコロ監視エリア
        DICE_MONITOR: 'host-dice-monitor',

        // 手番プレイヤー手動制御エリア
        TURN_CONTROL: {
            INPUT_NEXT_ORDER: 'input-next-order',
            BTN_SET_TURN: 'btn-set-turn'
        },

        // 退室管理エリア
        KICK_CONTROL: {
            INPUT_KICK_ORDER: 'input-kick-order',
            BTN_KICK_PARTICIPANT: 'btn-kick-participant',
            BTN_CLEAR_ROOM: 'btn-clear-room'
        },

        // 参加者名簿テーブル
        PARTICIPANT_LIST: 'host-participant-list',
        
        // 名簿の各行（DOM行生成時やセレクター特定用）で利用するクラス・属性の識別子
        PARTICIPANT_ITEM: {
            ROW_CLASS: 'host-participant-row',
            PROFESSION_CLASS: 'host-participant-profession' 
        },

        // ホスト用盤面モニターID生成用のプレフィックス
        BOARD: {
            CELL_PREFIX: 'cell-' 
        }
    }
};
