require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { createCanvas } = require('canvas');
const fs = require('fs');

// Configure these environment variables in your .env file
// SUPABASE_URL=your_supabase_url
// SUPABASE_SERVICE_KEY=your_supabase_service_role_key
// BUCKET_NAME=your_storage_bucket_name

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const bucketName = process.env.BUCKET_NAME;

if (!supabaseUrl || !supabaseKey || !bucketName) {
  console.error("Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_KEY, or BUCKET_NAME");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const isDryRun = process.argv.includes('--dry-run');

function generateCardImage(card) {
  // Create a canvas with standard card dimensions (e.g., 400x600)
  const width = 400;
  const height = 600;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#f9f9f9';
  ctx.fillRect(0, 0, width, height);

  // Border
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, width - 10, height - 10);

  // Header (Deck Type)
  ctx.fillStyle = '#333';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  const deckType = card.deck_type ? card.deck_type.toUpperCase().replace('_', ' ') : 'UNKNOWN';
  ctx.fillText(deckType, width / 2, 50);

  // Divider
  ctx.beginPath();
  ctx.moveTo(20, 70);
  ctx.lineTo(width - 20, 70);
  ctx.stroke();

  // Title
  ctx.fillStyle = '#d9534f';
  ctx.font = 'bold 28px Arial';

  // Simple word wrap for title (if needed)
  wrapText(ctx, card.title || 'No Title', width / 2, 110, width - 40, 32);

  // Description
  ctx.fillStyle = '#000';
  ctx.font = '18px Arial';
  ctx.textAlign = 'left';
  wrapText(ctx, card.description || '', 20, 200, width - 40, 24);

  return canvas.toBuffer('image/png');
}

// Utility to wrap text in canvas
function wrapText(context, text, x, y, maxWidth, lineHeight) {
  const words = text.split(''); // Simple char split for Japanese/mixed text support
  let line = '';

  for (let n = 0; n < words.length; n++) {
    let testLine = line + words[n];
    let metrics = context.measureText(testLine);
    let testWidth = metrics.width;

    // For English words we normally split by space, but for Japanese chars split is safer
    if (testWidth > maxWidth && n > 0) {
      if (context.textAlign === 'center') {
        context.fillText(line, x, y);
      } else {
        context.fillText(line, x, y);
      }
      line = words[n];
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (context.textAlign === 'center') {
      context.fillText(line, x, y);
  } else {
      context.fillText(line, x, y);
  }
}


async function main() {
  console.log(`Starting card image generation script... (Dry Run: ${isDryRun})`);

  try {
    // 1. Fetch records where image_url is NULL
    const { data: cards, error: fetchError } = await supabase
      .from('cards')
      .select('*')
      .is('image_url', null);

    if (fetchError) {
      throw new Error(`Error fetching cards: ${fetchError.message}`);
    }

    if (!cards || cards.length === 0) {
      console.log('No cards found needing image generation.');
      return;
    }

    console.log(`Found ${cards.length} card(s) without images.`);

    // 2. Process each card
    for (const card of cards) {
      try {
        console.log(`Processing card ID: ${card.id} - ${card.title}`);

        // Generate image buffer
        const imageBuffer = generateCardImage(card);
        const fileName = `card_${card.id}_${Date.now()}.png`;

        if (isDryRun) {
           console.log(`[DRY RUN] Would upload ${fileName} to bucket '${bucketName}' and update card ID ${card.id}`);
           continue;
        }

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(fileName, imageBuffer, {
            contentType: 'image/png',
            upsert: false
          });

        if (uploadError) {
           throw new Error(`Upload failed: ${uploadError.message}`);
        }

        // Get public URL
        const { data: publicUrlData } = supabase.storage
          .from(bucketName)
          .getPublicUrl(fileName);

        const publicUrl = publicUrlData.publicUrl;

        // Update database record
        const { error: updateError } = await supabase
          .from('cards')
          .update({ image_url: publicUrl })
          .eq('id', card.id);

        if (updateError) {
           throw new Error(`Failed to update DB for card ID ${card.id}: ${updateError.message}`);
        }

        console.log(`Successfully generated and updated card ID ${card.id}. URL: ${publicUrl}`);

      } catch (err) {
        console.error(`Error processing card ID ${card.id}:`, err.message);
        // Continue to the next card even if one fails
      }
    }

  } catch (err) {
    console.error("Critical error in script execution:", err);
  }

  console.log("Script execution finished.");
}

main();
