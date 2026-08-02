// common_dom_selectors.js

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

        // システムメッセージ表示エリア
        MESSAGE: {
            TITLE: 'system-message-title',
            BODY: 'system-message-body',
            TABLE_BODY: 'message-table-body' // 動的メッセージ表示用のtbody
        },

        // あなたのステータス表示エリア
        STATUS: {
            SECTION: 'section-guest',
            ROOM_ID: 'guest-room-id',
            NAME: 'guest-name',
            DISPLAY_CURRENT_CASH: 'display-current-cash', 
            ROLE: 'guest-role',
            PROFESSION: 'guest-profession',
            CHILDREN_COUNT: 'guest-children-count',
            PER_CHILD_EXPENSE: 'guest-per-child-expense'
        },

        // 手番・サイコロ制御エリア
        CONTROLS: {
            STATUS_AREA: 'dice-status-area',
            DICE_RESULT: 'guest-dice-result',
            MANUAL_ACTION_AREA: 'manual-action-area',
            BTN_ROLL_DICE: 'btn-roll-dice',
            BTN_ROLL_DICE_2: 'btn-roll-dice-2',
            BTN_CLAIM_PAYCHECK: 'btn-claim-paycheck', 
            BTN_END_TURN: 'btn-end-turn',            
            BTN_ESCAPE_RAT_RACE: 'btn-escape-rat-race' 
        },

        // カードドロー・取引エリア
        CARD: {
            CONTAINER: 'card-display-container',
            NUMERICAL_DETAILS_CONTAINER: 'card-numerical-details', 
            DETAIL_COST: 'card-detail-cost',               
            DETAIL_DOWNPAYMENT: 'card-detail-downpayment', 
            DETAIL_CASHFLOW: 'card-detail-cashflow',       
            DRAW_OPTIONS_CONTAINER: 'deck-draw-options',   
            BTN_DRAW_SMALL_DEAL: 'btn-draw-small-deal',    
            BTN_DRAW_BIG_DEAL: 'btn-draw-big-deal',        
            BTN_DRAW_MARKET: 'btn-draw-market',            
            BTN_DRAW_DOODAD: 'btn-draw-doodad',            
            BTN_ACTION_DONATE: 'btn-action-donate',        
            BTN_ACTION_DOWNSIZED: 'btn-action-downsized',  
            OPTIONS_CONTAINER: 'card-action-options',    
            BTN_CARD_PASS: 'btn-card-pass',
            BTN_BUY_REALESTATE: 'btn-card-buy-realestate', 
            BTN_BUY_STOCK: 'btn-card-buy-stock',           
            BTN_SELL_STOCK: 'btn-card-sell-stock',         
            INPUT_PAYMENT_AMOUNT: 'input-payment-amount', // ★追加: 汎用支払い金額入力
            BTN_EXECUTE_PAYMENT: 'btn-execute-payment'    // ★追加: 汎用支払いボタン（「支払いを実行」用）
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
            
            // 負債の表示ID
            LIABILITY_MORTGAGE: 'display-liability-mortgage',
            LIABILITY_SCHOOL_LOAN: 'display-liability-school-loan', 
            LIABILITY_CAR_LOAN: 'display-liability-carloan',
            LIABILITY_CREDIT_CARD: 'display-liability-credit-card', 
            LIABILITY_RETAIL: 'display-liability-retail',
            DISPLAY_LIABILITY_BANKLOAN: 'display-liability-bankloan',    
            
            // 銀行ローン操作
            LOAN_CONTROL_CONTAINER: 'bank-loan-control',  
            BTN_BORROW_LOAN: 'btn-borrow-loan',            
            BTN_PAYBACK_LOAN: 'btn-payback-loan',          
            
            // 各種支出の表示ID
            DISPLAY_EXPENSE_TAXES: 'display-expense-taxes', 
            DISPLAY_EXPENSE_MORTGAGE: 'display-expense-mortgage', 
            DISPLAY_EXPENSE_SCHOOL: 'display-expense-school', 
            DISPLAY_EXPENSE_CAR: 'display-expense-car', 
            DISPLAY_EXPENSE_CREDIT: 'display-expense-credit', 
            DISPLAY_EXPENSE_RETAIL: 'display-expense-retail', 
            DISPLAY_EXPENSE_OTHER: 'display-expense-other', 
            DISPLAY_EXPENSE_CHILD: 'display-expense-child',
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
            // デッキ個別の手動リシャッフルボタン用
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
        
        // 名簿の各行（DOM行生成時やセレクター特定用）で利用するクラス・属性の識別子
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

console.log("【デバッグ】common_dom_selectors.js が読み込まれました。");
