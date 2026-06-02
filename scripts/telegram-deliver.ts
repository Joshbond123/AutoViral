/**
 * telegram-deliver.ts
 * Standalone Telegram delivery script.
 * Called by the telegram-deliver GitHub Actions workflow when "Send to Agent"
 * is clicked in the UI.
 *
 * Usage:
 *   npx tsx scripts/telegram-deliver.ts --queue-id <uuid>
 *   npx tsx scripts/telegram-deliver.ts              (processes all pending queue items)
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function deliverQueueItem(item: any): Promise<void> {
  console.log(`\n▶ Delivering queue item ${item.id.slice(0, 8)} for user ${item.user_id.slice(0, 8)}`);

  await supabase
    .from('telegram_delivery_queue')
    .update({ status: 'processing' })
    .eq('id', item.id);

  const { data: tgSettings } = await supabase
    .from('telegram_settings')
    .select('api_id, api_hash, session_string, target_chat')
    .eq('user_id', item.user_id)
    .maybeSingle();

  if (!tgSettings?.api_id || !tgSettings?.api_hash || !tgSettings?.session_string) {
    const errMsg = 'Telegram credentials not configured — add API ID, API Hash, and Session String in Settings';
    console.error(`  ❌ ${errMsg}`);
    await supabase
      .from('telegram_delivery_queue')
      .update({ status: 'failed', error_message: errMsg })
      .eq('id', item.id);
    return;
  }

  const { data: instructionRows } = await supabase
    .from('agent_instructions')
    .select('instruction')
    .eq('user_id', item.user_id)
    .order('created_at', { ascending: true });

  const instructionsText = (instructionRows ?? []).map((i: any) => i.instruction).join('\n');
  const targetChat = tgSettings.target_chat || 'claw';

  const escapeMd = (s: string) => (s || '').replace(/[_*[\]()~`>#+=|{}.!]/g, '\\$&');
  const messageLines = [
    `📹 *${escapeMd(item.title || 'AutoViral Video')}*`,
    '',
    item.caption ? `📝 ${item.caption}` : '',
    item.hashtags || '',
    instructionsText ? `\n📋 *Agent Instructions*\n${instructionsText}` : '',
  ].filter(s => s !== undefined && s !== '').join('\n').trim();

  let tmpVideoPath: string | null = null;

  try {
    console.log(`  Downloading video from storage...`);
    const videoResp = await fetch(item.video_url);
    if (!videoResp.ok) throw new Error(`Failed to download video: ${videoResp.status}`);
    const videoBuffer = Buffer.from(await videoResp.arrayBuffer());
    tmpVideoPath = join(tmpdir(), `tg_deliver_${item.id.slice(0, 8)}_${Date.now()}.mp4`);
    writeFileSync(tmpVideoPath, videoBuffer);
    console.log(`  Downloaded ${(videoBuffer.byteLength / 1024 / 1024).toFixed(1)} MB`);

    const { TelegramClient } = await import('telegram') as any;
    const { StringSession } = await import('telegram/sessions/index.js') as any;

    const stringSession = new StringSession(tgSettings.session_string);
    const client = new TelegramClient(
      stringSession,
      parseInt(tgSettings.api_id),
      tgSettings.api_hash,
      { connectionRetries: 3, useWSS: true }
    );

    console.log(`  Connecting to Telegram...`);
    await client.connect();

    try {
      console.log(`  Sending video to @${targetChat}...`);
      await client.sendFile(targetChat, {
        file: tmpVideoPath,
        caption: messageLines,
        parseMode: 'md',
        forceDocument: false,
        workers: 1,
      });
      console.log(`  ✅ Delivered to @${targetChat}`);

      await supabase
        .from('telegram_delivery_queue')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          error_message: null,
        })
        .eq('id', item.id);

      if (item.post_id) {
        await supabase.from('posts').update({
          status: 'published',
          published_at: new Date().toISOString(),
          publish_result: `telegram:${targetChat}`,
        }).eq('id', item.post_id);
      }

      await supabase.from('notifications').insert({
        user_id: item.user_id,
        title: 'Video Delivered to Agent',
        message: `"${item.title || 'Your video'}" has been sent to your Telegram agent (@${targetChat}).`,
        type: 'success',
        post_id: item.post_id ?? null,
      }).catch(() => {});

    } finally {
      await client.disconnect();
    }

  } catch (e: any) {
    const errMsg = e.message?.slice(0, 500) ?? String(e);
    console.error(`  ❌ Delivery failed: ${errMsg}`);
    await supabase
      .from('telegram_delivery_queue')
      .update({ status: 'failed', error_message: errMsg })
      .eq('id', item.id);

    await supabase.from('notifications').insert({
      user_id: item.user_id,
      title: 'Telegram Delivery Failed',
      message: `Could not deliver to Telegram: ${errMsg.slice(0, 120)}`,
      type: 'error',
      post_id: item.post_id ?? null,
    }).catch(() => {});

  } finally {
    if (tmpVideoPath && existsSync(tmpVideoPath)) {
      try { unlinkSync(tmpVideoPath); } catch { /* ignore */ }
    }
  }
}

async function main(): Promise<void> {
  console.log('📨 AutoViral Telegram Delivery — ' + new Date().toISOString());

  const queueIdArg = (() => {
    const i = process.argv.indexOf('--queue-id');
    return i !== -1 ? process.argv[i + 1] : null;
  })();

  let items: any[] = [];

  if (queueIdArg) {
    console.log(`🎯 Delivering specific queue item: ${queueIdArg}`);
    const { data } = await supabase
      .from('telegram_delivery_queue')
      .select('*')
      .eq('id', queueIdArg)
      .in('status', ['pending', 'failed'])
      .limit(1);
    items = data ?? [];
  } else {
    const { data } = await supabase
      .from('telegram_delivery_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10);
    items = data ?? [];
  }

  if (items.length === 0) {
    console.log('✓ No pending Telegram deliveries.');
    return;
  }

  console.log(`Found ${items.length} item(s) to deliver.`);
  for (const item of items) {
    await deliverQueueItem(item);
  }

  console.log('\n✅ Telegram delivery complete!');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
