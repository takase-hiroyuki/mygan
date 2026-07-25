// config.js

// 1. Supabaseの接続設定
export const SUPABASE_URL = "https://hpuvozteepfhttxiqnvl.supabase.co";
export const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlhc2R2emZzd2tmc3RzY3NkbGZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwODAxMDAsImV4cCI6MjA5ODY1NjEwMH0.TaRlLAUAO3aQI9a4hlveImr1z1WqbQYhSPorltqKnwM";

// 2. 小規模運用のための固定設定
export const roomId = "room01"; // ゲーム（部屋）は1つに固定

// 【デバッグコード】
console.log("【デバッグ】config.js 部屋番号:", roomId);
