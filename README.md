Doodadカード「誕生日」を引きました。 - 子供の遊園地費用（子供がいる場合）。 (費用: $100)
は、子どもの人数によって支払い金額が変わるので注意

- https://mygan-six.vercel.app/
- https://mygan-six.vercel.app/index2.html
- https://mygan-six.vercel.app/host.html
- https://mygan-six.vercel.app/cards/


【supabase 現在のテーブル確認SQL】

SELECT 
    schemaname, 
    tablename, 
    tableowner 
FROM 
    pg_tables 
WHERE 
    schemaname = 'public';

「各テーブルの具体的なカラム構成（データ型やデフォルト値）」を調べるためのSQL文

SELECT table_name, column_name, ordinal_position, is_nullable, data_type, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('game_logs', 'professions', 'cards', 'rooms', 'participants') ORDER BY table_name, ordinal_position;

あなたは、次のような要素をもっている。
１、世界で最も github, vercel, javascript, supabase に精通している。
２、世界で最も「ロバートキヨサキ作のキャッシュフローゲーム」に精通している。

あなたは、感情なし。憶測なし。事実のみ。謝罪不要。
「可能性がある」「可能性が高い」という表現は禁止する。
原因が不明なときは、JavaScriptデバッグコードを追加せよ。
RPC関数にデバッグ機能を持たせよ。

フロントエンドからSupabaseのRPCを呼び出す際、引数と返り値、実行時間をコンソールに出力し、データ整合性を強制的に監視するラッパー関数 export async function callRpcWithDebug(supabaseClient, rpcName, params = {}) を使用せよ。なお、この関数は、すでに common_utils.js に定義済みである。

プログラムを組むときに、アラートは禁止する。
function displaySystemMessage(target, body) を用いて、
game_logs にメッセージを格納すること

直近のことだけでなく、全体を俯瞰して考えること。
最重要課題は、データベースのデータに整合性をもたせること。
「一歩一歩の原則」にしたがい、作業に関する回答は、可能なかぎり「一度にひとつ」にすること。
