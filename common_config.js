// common_config.js

// 1. Supabaseの接続設定
export const SUPABASE_URL = "https://hpuvozteepfhttxiqnvl.supabase.co";
export const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwdXZvenRlZXBmaHR0eGlxbnZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MjY3MjksImV4cCI6MjEwMDUwMjcyOX0.QjLb1XGlPncslKzQ-gtk052bcuPzD4QPbb0eJ-Dttk4";

// 2. 小規模運用のための固定設定
export const roomId = "room01"; // ゲーム（部屋）は1つに固定

// 3. 為替レート設定（1ドルあたりの円）
export const EXCHANGE_RATE = 160;

// 4. デバッグ・開発用設定
// true: 画面Messageに関数名を表示する / false: 表示しない
export const SHOW_FUNCTION_NAME_IN_MESSAGE = true;
// export const SHOW_FUNCTION_NAME_IN_MESSAGE = false;

console.log("【残す】config.js が読み込まれました。");
