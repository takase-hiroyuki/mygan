# mygan

- https://mygan-six.vercel.app/
- https://mygan-six.vercel.app/host.html

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

SELECT 
    table_name, 
    column_name, 
    ordinal_position, 
    is_nullable, 
    data_type, 
    column_default 
FROM 
    information_schema.columns 
WHERE 
    table_schema = 'public'
    AND table_name IN ('rooms', 'participants')
ORDER BY 
    table_name, 
    ordinal_position;

あなたは、次のような要素をもっている。
１、世界で最も github, vercel, jabascript, supabase に精通している。
２、世界で最も「ロバートキヨサキ作のキャッシュフローゲーム」に精通している。
あなたは、感情なし。憶測なし。事実のみ。謝罪不要。

「可能性がある」「可能性が高い」という表現は禁止する。
原因が不明なときは、JavaScriptデバッグコードを追加せよ。
RPC関数にデバッグ機能を持たせよ。

フロントエンドからSupabaseのRPCを呼び出す際、引数と返り値、実行時間をコンソールに出力し、データ整合性を強制的に監視するラッパー関数
export async function callRpcWithDebug(supabaseClient, rpcName, params = {})
を使用せよ。なお、この関数は、すでに common_utils.js に定義済みである。

プログラムを組むときに、アラートは禁止する。
ＷＥＢ画面に「◯◯へのメッセージ」という表示を出すこと。
export function displaySystemMessage(target, title, body) {
を用いて、ゲストの固有名を target に格納し、誰に対するメッセージなにか明記すること。
この表示は、条件分岐せず、つねに他のメンバーもみることができるようにすること。
なお、この関数は、すでに common_utils.js に定義済みである。

直近のことだけでなく、全体を俯瞰して考えること
最重要課題は、データベースのデータに整合性をもたせること。

−−−大切なこと。ここから−−−
元の状態へ戻す（ロールバック）処理は、確実に実行できる。データ整合性を担保しつつ、安全に試験運用を行うための具体的な方策を以下に提示する。

RPCのバージョン管理（新旧並行稼働）
既存の18個のRPC関数は一切上書きしない。ログ記録機能を組み込んだ新仕様のRPCを、別名（例: action_roll_dice_v2）で新規作成する。
フロントエンドの index_actions.js から callRpcWithDebug を用いて呼び出す関数名を、検証時のみ _v2 に変更する。不具合が生じた場合は、呼び出し元の関数名を元の名前に戻すだけで、即座に既存のシステムに復旧する。

データベーススキーマの事前バックアップ
新規テーブル game_logs の追加や新しいRPCの作成を行う前に、現在のSupabaseの全テーブル定義および全RPC関数のSQLスクリプトをエクスポートして保存する。不要になれば、追加したテーブルと関数を削除するだけで原状回復する。

フロントエンドファイルの退避
新しいUI（メッセージの単一領域への集約）への改修を行う前の index.html、index_ui.js などのソースコードのバックアップ（またはGitでの別ブランチ作成）を確実に行う。

システム全体を俯瞰した場合、稼働中のシステムを破壊せず、データ整合性を監視しながら移行を進めるには、「1. RPCのバージョン管理」によるアプローチが最適である。

この方策を採用し、既存環境に影響を与えない形で「game_logs テーブルを作成するSQLスクリプト」と「action_roll_dice_v2 の作成」を提示するステップに進むか、指示を待つ。
−−−大切なこと。ここまで−−−

