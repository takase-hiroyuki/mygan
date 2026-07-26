// config.js

// 1. Supabaseの接続設定
export const SUPABASE_URL = "https://hpuvozteepfhttxiqnvl.supabase.co";
export const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwdXZvenRlZXBmaHR0eGlxbnZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MjY3MjksImV4cCI6MjEwMDUwMjcyOX0.QjLb1XGlPncslKzQ-gtk052bcuPzD4QPbb0eJ-Dttk4";

// 2. 小規模運用のための固定設定
export const roomId = "room01"; // ゲーム（部屋）は1つに固定

export const BOARD_CELL_NAMES = [
    "ＣＦ", "娯楽", "好機", "寄付", "好機", "ＣＦ", "好機", "娯楽",
    "好機", "子供", "好機", "ＣＦ", "市場", "好機", "娯楽", "好機",
    "寄付", "好機", "ＣＦ", "好機", "解雇", "好機", "市場", "好機"
];

// 【デバッグコード】
console.log("【デバッグ】config.js 部屋番号:", roomId);
