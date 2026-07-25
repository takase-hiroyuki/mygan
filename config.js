// config.js

// 1. Supabaseの接続設定
export const SUPABASE_URL = "https://iasdvzfswkfstscsdlfd.supabase.co";
export const SUPABASE_KEY = "sb_publishable_z_JmCe9P8RyKz_-0zZtEOQ_OKcTryro";

// 2. 小規模運用のための固定設定
export const roomId = "room01"; // ゲーム（部屋）は1つに固定

// 【デバッグコード】
console.log("【デバッグ】config.js が読み込まれました。部屋IDは固定です:", roomId);
