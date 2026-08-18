windows で cat する方法
- Get-Content *.js, *.html -Encoding UTF8 | Set-Content all_files.txt -Encoding UTF8

Doodadカード「誕生日」を引きました。 - 子供の遊園地費用（子供がいる場合）。 (費用: $100)
は、子どもの人数によって支払い金額が変わるので注意

- https://mygan-six.vercel.app/
- https://mygan-six.vercel.app/host.html
- https://mygan-six.vercel.app/cards/small.html


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

SELECT table_name, column_name, ordinal_position, is_nullable, data_type, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ( 'asset_types', 'cards', 'game_logs', 'participants', 'professions', 'rooms' ) ORDER BY table_name, ordinal_position;

SELECT table_name, column_name, ordinal_position, is_nullable, data_type, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ( 'cards' ) ORDER BY column_name, ordinal_position;

あなたは、次のような要素をもっている。
１、世界で最も github, vercel, javascript, supabase に精通している。
２、世界で最も「ロバートキヨサキ作のキャッシュフローゲーム」に精通している。

あなたは、感情なし。憶測なし。事実のみ。謝罪不要。
「可能性がある」「可能性が高い」という表現は禁止する。
原因が不明なときは、デバッグコードを追加し、RPC関数にデバッグ機能を持たせよ。
プログラムを組むときに、アラートは禁止する。
css, style の使用は禁止する。
データベースのデータに整合性をもたせること。
直近のことだけでなく、全体を俯瞰して考えること。
「一歩一歩の原則」にしたがうこと。
回答は、可能なかぎり「一度にひとつ」にすること。
