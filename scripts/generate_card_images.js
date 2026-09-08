/**
 * generate_card_images.js
 *
 * Supabaseの cards テーブルにあるデータをもとに、各カードに対応する画像を自動生成して保存するバッチスクリプト。
 *
 * 【必要な環境変数】
 * ルートディレクトリ（または実行ディレクトリ）に `.env` ファイルを作成し、以下を記述してください。
 * SUPABASE_URL=あなたのSupabaseプロジェクトURL (例: https://xxxx.supabase.co)
 * SUPABASE_KEY=あなたのSupabaseサービスロールキー または ANONキー (更新権限があるもの)
 * OPENAI_API_KEY=あなたのOpenAI APIキー (sk-...)
 * IMAGE_COLUMN_NAME=画像URLを保存するカラム名 (省略時: image_url)
 * SUPABASE_STORAGE_BUCKET=画像ファイルを保存するStorageのバケット名 (省略時: card-images)
 *
 * 【実行方法】
 * 1. 必要なパッケージをインストールします:
 *    npm install @supabase/supabase-js openai dotenv node-fetch
 * 2. スクリプトを実行します:
 *    node scripts/generate_card_images.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { OpenAI } = require('openai');
const fetch = require('node-fetch');

// 環境変数の取得とデフォルト値の設定
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const IMAGE_COLUMN = process.env.IMAGE_COLUMN_NAME || 'image_url';
const BUCKET_NAME = process.env.SUPABASE_STORAGE_BUCKET || 'card-images';

// 必須環境変数のチェック
if (!SUPABASE_URL || !SUPABASE_KEY || !OPENAI_API_KEY) {
    console.error('Error: 必要な環境変数 (SUPABASE_URL, SUPABASE_KEY, OPENAI_API_KEY) が設定されていません。');
    console.error('.env ファイルを確認するか、環境変数を設定して再度実行してください。');
    process.exit(1);
}

// クライアントの初期化
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

async function main() {
    console.log('=== カード画像自動生成バッチ開始 ===');
    console.log(`設定: ターゲットカラム='${IMAGE_COLUMN}', ストレージバケット='${BUCKET_NAME}'`);

    try {
        // 1. Supabaseからカードデータを取得
        // 指定された画像カラムが NULL または空文字のレコードを取得
        console.log(`\n1. Supabaseから対象レコードを取得中...`);
        const { data: cards, error: fetchError } = await supabase
            .from('cards')
            .select('*')
            .is(IMAGE_COLUMN, null); // 簡易的にnullのみを対象とする。必要に応じて .eq や .or で拡張

        if (fetchError) {
            // カラムが存在しないエラーの場合は、メッセージを分かりやすくする
            if (fetchError.code === '42703') {
                 console.error(`Error: テーブル 'cards' にカラム '${IMAGE_COLUMN}' が存在しません。`);
                 console.error(`データベースのスキーマを確認するか、環境変数 IMAGE_COLUMN_NAME を正しいカラム名に変更してください。`);
            } else {
                 console.error('Error fetching cards:', fetchError);
            }
            return;
        }

        if (!cards || cards.length === 0) {
            console.log('対象となるカード（画像未生成）はありません。処理を終了します。');
            return;
        }

        console.log(`${cards.length} 件の対象レコードが見つかりました。`);

        // 2. 各カードについて画像生成とアップロードを実行
        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];
            console.log(`\n--- 処理中 [${i + 1}/${cards.length}]: ID=${card.id}, Title="${card.title || '無題'}" ---`);

            try {
                // A. 画像生成プロンプトの作成
                const prompt = `A highly detailed and professional illustration for a board game card.
Deck type: ${card.deck_type || 'Unknown'}.
Title: ${card.title || 'Unknown'}.
Description: ${card.description || 'No description'}.
Style: Vibrant, clean, suitable for a financial and life simulation board game.`;

                console.log('OpenAI(DALL-E)で画像を生成中...');

                // B. OpenAI APIで画像生成
                // ※ ここでは DALL-E 3 を想定。コストや速度に応じて dalle-2 等に変更可能
                const imageResponse = await openai.images.generate({
                    model: "dall-e-3",
                    prompt: prompt,
                    n: 1,
                    size: "1024x1024",
                });

                const generatedImageUrl = imageResponse.data[0].url;
                if (!generatedImageUrl) {
                    throw new Error('画像の生成URLが取得できませんでした。');
                }
                console.log('画像生成成功。画像をダウンロード中...');

                // C. 生成された画像をダウンロード
                const imgFetchRes = await fetch(generatedImageUrl);
                if (!imgFetchRes.ok) {
                    throw new Error(`画像のダウンロードに失敗しました: ${imgFetchRes.statusText}`);
                }
                const arrayBuffer = await imgFetchRes.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);

                // ファイル名の決定 (例: card_123_1680000000.png)
                const fileName = `card_${card.id}_${Date.now()}.png`;
                const filePath = `images/${fileName}`;

                console.log(`Supabase Storage (${BUCKET_NAME}) にアップロード中... -> ${filePath}`);

                // D. Supabase Storageへアップロード
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from(BUCKET_NAME)
                    .upload(filePath, buffer, {
                        contentType: 'image/png',
                        upsert: true
                    });

                if (uploadError) {
                    throw new Error(`Storageアップロードエラー: ${uploadError.message}`);
                }

                // E. 公開URLの取得
                const { data: publicUrlData } = supabase.storage
                    .from(BUCKET_NAME)
                    .getPublicUrl(filePath);

                const publicUrl = publicUrlData.publicUrl;
                if (!publicUrl) {
                    throw new Error('公開URLの取得に失敗しました。');
                }
                console.log(`アップロード成功。公開URL: ${publicUrl}`);

                console.log(`データベースの ${IMAGE_COLUMN} カラムを更新中...`);

                // F. データベースの更新
                const updatePayload = {};
                updatePayload[IMAGE_COLUMN] = publicUrl;

                const { error: updateError } = await supabase
                    .from('cards')
                    .update(updatePayload)
                    .eq('id', card.id);

                if (updateError) {
                    throw new Error(`データベース更新エラー: ${updateError.message}`);
                }

                console.log(`=> 成功: カード ID=${card.id} の処理が完了しました。`);

            } catch (error) {
                console.error(`=> エラー: カード ID=${card.id} の処理中にエラーが発生しました。`);
                console.error(error);
                // 1件エラーが出ても、ループを止めずに次のカードの処理へ進む設計
            }
        }

        console.log('\n=== 全ての処理が完了しました ===');

    } catch (globalError) {
        console.error('\n致命的なエラーが発生しました:');
        console.error(globalError);
    }
}

// 実行
if (require.main === module) {
    main();
}
