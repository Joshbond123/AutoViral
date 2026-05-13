/**
 * ██████╗ ██████╗  ██████╗ ████████╗███████╗██╗   ██╗███████╗
 * ██╔══██╗██╔══██╗██╔═══██╗╚══██╔══╝██╔════╝██║   ██║██╔════╝
 * ██████╔╝██████╔╝██║   ██║   ██║   █████╗  ██║   ██║███████╗
 * ██╔═══╝ ██╔══██╗██║   ██║   ██║   ██╔══╝  ██║   ██║╚════██║
 * ██║     ██║  ██║╚██████╔╝   ██║   ███████╗╚██████╔╝███████║
 * ╚═╝     ╚═╝  ╚═╝ ╚═════╝    ╚═╝   ╚══════╝ ╚═════╝ ╚══════╝
 *
 * Proteus Cleanup Engine — AutoViral Storage & Database Overflow Prevention
 *
 * Runs daily via GitHub Actions to prevent Supabase storage and DB overflow.
 * Designed for reliability: logs every action, never silently fails critical steps.
 *
 * Cleanup targets:
 *   - Orphaned storage objects (files in storage with no matching DB record)
 *   - Videos for permanently failed posts (status = 'failed')
 *   - Old rendered videos beyond the retention window (default: 30 days)
 *   - Stale manual_jobs stuck in 'running' state beyond 90 minutes
 *   - Stale schedule runs stuck in 'running' beyond 90 minutes
 *   - Expired api_key 'failed' status — reset daily so keys are retried
 *   - Old cleanup_logs beyond 90-day retention
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ─── Configuration ────────────────────────────────────────────────────────────

const CONFIG = {
  // Videos older than this are eligible for deletion (30 days)
  videoRetentionDays: 30,
  // Keep at least this many videos per user regardless of age
  minVideosPerUser: 5,
  // Jobs stuck in 'running' beyond this are considered stale (90 minutes)
  staleJobThresholdMinutes: 90,
  // Orphaned objects (no DB record) older than this are deleted (2 hours)
  orphanAgeHours: 2,
  // Cleanup logs are kept for 90 days then pruned
  cleanupLogRetentionDays: 90,
  // Failed api_key statuses are reset after this many hours (daily reset)
  apiKeyResetHours: 20,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface CleanupStats {
  orphanedVideosDeleted: number;
  orphanedThumbsDeleted: number;
  failedPostVideosDeleted: number;
  expiredVideosDeleted: number;
  staleJobsReset: number;
  staleSchedulesReset: number;
  apiKeysReset: number;
  cleanupLogsDeleted: number;
  errors: string[];
  bytesFreed: number;
}

function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

// ─── Phase 1: Stale Job Recovery ──────────────────────────────────────────────

async function resetStaleJobs(stats: CleanupStats): Promise<void> {
  console.log('\n📋 Phase 1: Stale job recovery...');
  const threshold = minutesAgo(CONFIG.staleJobThresholdMinutes);

  try {
    // Reset stale manual_jobs
    const { data: staleManual, error: mErr } = await supabase
      .from('manual_jobs')
      .select('id, user_id')
      .eq('status', 'running')
      .lte('last_run_at', threshold);

    if (mErr) throw mErr;

    if ((staleManual ?? []).length > 0) {
      for (const job of staleManual!) {
        await supabase.from('manual_jobs').update({
          status: 'failed',
          last_error: `Proteus: job timed out after ${CONFIG.staleJobThresholdMinutes} minutes (auto-reset by daily cleanup)`,
        }).eq('id', job.id);
        stats.staleJobsReset++;
        console.log(`  ✓ Reset stale manual_job ${job.id.slice(0, 8)}`);
      }
    } else {
      console.log('  ✓ No stale manual_jobs found');
    }

    // Reset stale schedules
    const { data: staleScheds, error: sErr } = await supabase
      .from('schedules')
      .select('id')
      .eq('status', 'running')
      .lte('last_run_at', threshold);

    if (sErr) throw sErr;

    if ((staleScheds ?? []).length > 0) {
      for (const sched of staleScheds!) {
        await supabase.from('schedules').update({
          status: 'pending',
          last_run_status: 'failed',
          last_error: `Proteus: schedule timed out after ${CONFIG.staleJobThresholdMinutes} minutes (auto-reset by daily cleanup)`,
          scheduled_time: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        }).eq('id', sched.id);
        stats.staleSchedulesReset++;
        console.log(`  ✓ Reset stale schedule ${sched.id.slice(0, 8)}`);
      }
    } else {
      console.log('  ✓ No stale schedules found');
    }

    // Reset posts stuck in 'processing' for more than 90 minutes
    const { data: stuckPosts } = await supabase
      .from('posts')
      .select('id')
      .eq('status', 'processing')
      .lte('created_at', threshold);

    if ((stuckPosts ?? []).length > 0) {
      for (const post of stuckPosts!) {
        await supabase.from('posts').update({
          status: 'failed',
          publish_result: 'Proteus: post stuck in processing state — marked failed by daily cleanup',
        }).eq('id', post.id);
        console.log(`  ✓ Reset stuck post ${post.id.slice(0, 8)}`);
      }
    }

  } catch (e: any) {
    const msg = `Phase 1 error: ${e.message}`;
    stats.errors.push(msg);
    console.error(`  ❌ ${msg}`);
  }
}

// ─── Phase 2: API Key Status Reset ────────────────────────────────────────────

async function resetApiKeyStatuses(stats: CleanupStats): Promise<void> {
  console.log('\n🔑 Phase 2: API key status reset...');
  const threshold = hoursAgo(CONFIG.apiKeyResetHours);

  try {
    // Reset 'failed' keys that haven't been tried in 20+ hours — they may have recovered
    const { data: failedKeys } = await supabase
      .from('api_keys')
      .select('id, service, key_value')
      .eq('status', 'failed')
      .lte('last_used_at', threshold);

    if ((failedKeys ?? []).length > 0) {
      for (const key of failedKeys!) {
        await supabase.from('api_keys').update({ status: 'active' }).eq('id', key.id);
        stats.apiKeysReset++;
        console.log(`  ✓ Reset failed key [${key.id.slice(0, 8)}] (${key.service})`);
      }
    } else {
      console.log('  ✓ No failed keys to reset');
    }

    // Also reset 'rate_limited' keys that haven't been used in 2+ hours
    const { data: rateLimitedKeys } = await supabase
      .from('api_keys')
      .select('id, service')
      .eq('status', 'rate_limited')
      .lte('last_used_at', hoursAgo(2));

    if ((rateLimitedKeys ?? []).length > 0) {
      for (const key of rateLimitedKeys!) {
        await supabase.from('api_keys').update({ status: 'active' }).eq('id', key.id);
        console.log(`  ✓ Reset rate_limited key [${key.id.slice(0, 8)}] (${key.service})`);
      }
    }

  } catch (e: any) {
    const msg = `Phase 2 error: ${e.message}`;
    stats.errors.push(msg);
    console.error(`  ❌ ${msg}`);
  }
}

// ─── Phase 3: Orphaned Storage Object Cleanup ─────────────────────────────────

async function cleanOrphanedStorageObjects(stats: CleanupStats): Promise<void> {
  console.log('\n🗑️  Phase 3: Orphaned storage objects...');
  const ageThreshold = hoursAgo(CONFIG.orphanAgeHours);

  // Collect all valid URL basenames from the DB
  let validVideoNames = new Set<string>();
  let validThumbNames = new Set<string>();

  try {
    const { data: allPosts } = await supabase
      .from('posts')
      .select('video_url, thumbnail_url')
      .not('video_url', 'is', null);

    for (const p of (allPosts ?? [])) {
      if (p.video_url) {
        const name = p.video_url.split('/').pop();
        if (name) validVideoNames.add(name);
      }
      if (p.thumbnail_url) {
        const name = p.thumbnail_url.split('/').pop();
        if (name) validThumbNames.add(name);
      }
    }

    console.log(`  → ${validVideoNames.size} valid video URLs, ${validThumbNames.size} valid thumbnail URLs`);
  } catch (e: any) {
    stats.errors.push(`Failed to load valid URLs from DB: ${e.message}`);
    return;
  }

  // Scan storage buckets for orphaned objects
  const prefixes = ['videos', 'thumbnails', 'manual', 'manual-thumbnails'];

  for (const prefix of prefixes) {
    try {
      // List top-level user folders
      const { data: userFolders } = await supabase.storage.from('videos').list(prefix, { limit: 100 });

      for (const folder of (userFolders ?? [])) {
        if (!folder.id && folder.name) {
          // It's a folder — list its contents
          const { data: objects } = await supabase.storage
            .from('videos')
            .list(`${prefix}/${folder.name}`, { limit: 1000 });

          const toDelete: string[] = [];
          for (const obj of (objects ?? [])) {
            const isVideo = obj.name.endsWith('.mp4');
            const isThumb = obj.name.endsWith('.jpg') || obj.name.endsWith('.jpeg') || obj.name.endsWith('.png');
            const objAge = new Date(obj.updated_at ?? obj.created_at ?? 0).toISOString();

            if (objAge > ageThreshold) continue; // too recent — skip

            const isValid = isVideo
              ? validVideoNames.has(obj.name)
              : isThumb
              ? validThumbNames.has(obj.name)
              : false;

            if (!isValid) {
              toDelete.push(`${prefix}/${folder.name}/${obj.name}`);
            }
          }

          if (toDelete.length > 0) {
            const { error } = await supabase.storage.from('videos').remove(toDelete);
            if (!error) {
              const videoCount = toDelete.filter(p => p.endsWith('.mp4')).length;
              const thumbCount = toDelete.filter(p => !p.endsWith('.mp4')).length;
              stats.orphanedVideosDeleted += videoCount;
              stats.orphanedThumbsDeleted += thumbCount;
              console.log(`  ✓ ${prefix}/${folder.name}: deleted ${toDelete.length} orphaned objects`);
            } else {
              stats.errors.push(`Storage delete error in ${prefix}/${folder.name}: ${error.message}`);
            }
          }
        }
      }
    } catch (e: any) {
      const msg = `Phase 3 error scanning ${prefix}: ${e.message}`;
      stats.errors.push(msg);
      console.error(`  ❌ ${msg}`);
    }
  }

  if (stats.orphanedVideosDeleted === 0 && stats.orphanedThumbsDeleted === 0) {
    console.log('  ✓ No orphaned objects found');
  }
}

// ─── Phase 4: Failed Post Video Cleanup ───────────────────────────────────────

async function cleanFailedPostVideos(stats: CleanupStats): Promise<void> {
  console.log('\n❌ Phase 4: Videos for permanently failed posts...');

  try {
    const { data: failedPosts } = await supabase
      .from('posts')
      .select('id, video_url, thumbnail_url, user_id')
      .eq('status', 'failed')
      .not('video_url', 'is', null)
      .lte('created_at', hoursAgo(2)); // Only clean failed posts older than 2 hours

    if (!failedPosts || failedPosts.length === 0) {
      console.log('  ✓ No failed posts with videos to clean');
      return;
    }

    const videoKeys: string[] = [];
    const thumbKeys: string[] = [];

    for (const post of failedPosts) {
      if (post.video_url) {
        // Extract storage key from public URL
        const urlParts = post.video_url.split('/storage/v1/object/public/videos/');
        if (urlParts.length === 2) videoKeys.push(urlParts[1]);
      }
      if (post.thumbnail_url) {
        const urlParts = post.thumbnail_url.split('/storage/v1/object/public/videos/');
        if (urlParts.length === 2) thumbKeys.push(urlParts[1]);
      }
    }

    if (videoKeys.length > 0) {
      const { error } = await supabase.storage.from('videos').remove(videoKeys);
      if (!error) {
        stats.failedPostVideosDeleted += videoKeys.length;
        // Clear the video_url from failed posts so we don't try again
        await supabase.from('posts')
          .update({ video_url: null, thumbnail_url: null })
          .eq('status', 'failed')
          .not('video_url', 'is', null);
        console.log(`  ✓ Deleted ${videoKeys.length} video(s) and ${thumbKeys.length} thumbnail(s) for failed posts`);
      } else {
        stats.errors.push(`Phase 4 delete error: ${error.message}`);
      }
    } else {
      console.log('  ✓ No storage objects found for failed posts (URLs may already be cleared)');
    }

  } catch (e: any) {
    const msg = `Phase 4 error: ${e.message}`;
    stats.errors.push(msg);
    console.error(`  ❌ ${msg}`);
  }
}

// ─── Phase 5: Expired Video Retention ────────────────────────────────────────

async function cleanExpiredVideos(stats: CleanupStats): Promise<void> {
  console.log(`\n📅 Phase 5: Expired videos (>${CONFIG.videoRetentionDays} days old)...`);

  try {
    const retentionDate = daysAgo(CONFIG.videoRetentionDays);

    // Find posts with videos older than the retention window
    const { data: expiredPosts } = await supabase
      .from('posts')
      .select('id, video_url, thumbnail_url, user_id')
      .not('video_url', 'is', null)
      .lte('published_at', retentionDate)
      .in('status', ['published', 'rendered']);

    if (!expiredPosts || expiredPosts.length === 0) {
      console.log(`  ✓ No videos older than ${CONFIG.videoRetentionDays} days`);
      return;
    }

    // Group by user and enforce minimum retention
    const userVideos: Record<string, typeof expiredPosts> = {};
    for (const post of expiredPosts) {
      if (!userVideos[post.user_id]) userVideos[post.user_id] = [];
      userVideos[post.user_id].push(post);
    }

    let totalDeleted = 0;

    for (const [userId, posts] of Object.entries(userVideos)) {
      // Count total videos this user has — keep minimum
      const { count: totalCount } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .not('video_url', 'is', null);

      const userTotal = totalCount ?? 0;
      const canDelete = Math.max(0, userTotal - CONFIG.minVideosPerUser);
      const toProcess = posts.slice(0, canDelete);

      if (toProcess.length === 0) {
        console.log(`  ✓ User ${userId.slice(0, 8)}: keeping all ${userTotal} videos (minimum threshold)`);
        continue;
      }

      const videoKeys: string[] = [];
      const postIds: string[] = [];

      for (const post of toProcess) {
        if (post.video_url) {
          const urlParts = post.video_url.split('/storage/v1/object/public/videos/');
          if (urlParts.length === 2) {
            videoKeys.push(urlParts[1]);
            postIds.push(post.id);
          }
        }
        if (post.thumbnail_url) {
          const urlParts = post.thumbnail_url.split('/storage/v1/object/public/videos/');
          if (urlParts.length === 2) videoKeys.push(urlParts[1]);
        }
      }

      if (videoKeys.length > 0) {
        const { error } = await supabase.storage.from('videos').remove(videoKeys);
        if (!error) {
          await supabase.from('posts')
            .update({ video_url: null, thumbnail_url: null })
            .in('id', postIds);
          stats.expiredVideosDeleted += toProcess.length;
          totalDeleted += toProcess.length;
          console.log(`  ✓ User ${userId.slice(0, 8)}: deleted ${toProcess.length} expired video(s)`);
        } else {
          stats.errors.push(`Phase 5 delete error for user ${userId.slice(0, 8)}: ${error.message}`);
        }
      }
    }

    if (totalDeleted === 0) console.log('  ✓ No expired videos deleted this run');

  } catch (e: any) {
    const msg = `Phase 5 error: ${e.message}`;
    stats.errors.push(msg);
    console.error(`  ❌ ${msg}`);
  }
}

// ─── Phase 6: Cleanup Log Retention ──────────────────────────────────────────

async function pruneCleanupLogs(stats: CleanupStats): Promise<void> {
  console.log(`\n📜 Phase 6: Pruning old cleanup logs (>${CONFIG.cleanupLogRetentionDays} days)...`);

  try {
    const { data: oldLogs, error } = await supabase
      .from('cleanup_logs')
      .select('id')
      .lte('created_at', daysAgo(CONFIG.cleanupLogRetentionDays));

    if (error) throw error;

    if ((oldLogs ?? []).length > 0) {
      const ids = oldLogs!.map((l: any) => l.id);
      await supabase.from('cleanup_logs').delete().in('id', ids);
      stats.cleanupLogsDeleted = ids.length;
      console.log(`  ✓ Deleted ${ids.length} old cleanup log entries`);
    } else {
      console.log('  ✓ No old cleanup logs to prune');
    }
  } catch (e: any) {
    // cleanup_logs table may not exist yet — non-fatal
    if (!/relation.*does not exist|undefined/.test(e.message)) {
      console.warn(`  ⚠ Phase 6 warning: ${e.message?.slice(0, 120)}`);
    }
  }
}

// ─── Phase 7: Topic History Deduplication ─────────────────────────────────────

async function deduplicateTopicHistory(): Promise<void> {
  console.log('\n🔍 Phase 7: Topic history deduplication...');

  try {
    // Keep only the most recent 200 topics per niche
    const niches = [
      'Daily Crypto Scam', 'Crypto Wallet Drain', 'Fake Crypto Guru Exposed',
      'Crypto Investment Scam', 'Crypto Scam Psychology', 'AI Crypto Scam', 'Crypto Romance Scam',
    ];

    for (const niche of niches) {
      const { data: topics } = await supabase
        .from('topic_history')
        .select('id')
        .eq('niche', niche)
        .order('created_at', { ascending: false });

      if ((topics ?? []).length > 200) {
        const toDelete = topics!.slice(200).map(t => t.id);
        await supabase.from('topic_history').delete().in('id', toDelete);
        console.log(`  ✓ ${niche}: pruned ${toDelete.length} old topic entries`);
      }
    }

    console.log('  ✓ Topic history deduplication complete');
  } catch (e: any) {
    console.warn(`  ⚠ Phase 7 warning: ${e.message?.slice(0, 80)}`);
  }
}

// ─── Log Result to DB ─────────────────────────────────────────────────────────

async function logCleanupResult(stats: CleanupStats): Promise<void> {
  try {
    await supabase.from('cleanup_logs').insert({
      triggered_by: 'daily_scheduler',
      orphaned_videos_deleted: stats.orphanedVideosDeleted,
      orphaned_thumbs_deleted: stats.orphanedThumbsDeleted,
      failed_post_videos_deleted: stats.failedPostVideosDeleted,
      expired_videos_deleted: stats.expiredVideosDeleted,
      stale_jobs_reset: stats.staleJobsReset,
      stale_schedules_reset: stats.staleSchedulesReset,
      api_keys_reset: stats.apiKeysReset,
      cleanup_logs_deleted: stats.cleanupLogsDeleted,
      error_count: stats.errors.length,
      errors: stats.errors.length > 0 ? stats.errors.join(' | ') : null,
      notes: 'Daily Proteus Cleanup Engine run',
    });
  } catch { /* non-critical */ }
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const startTime = Date.now();
  console.log('🛡️  Proteus Cleanup Engine — AutoViral Storage Sentinel');
  console.log('   ' + new Date().toISOString());
  console.log('═'.repeat(62));

  const stats: CleanupStats = {
    orphanedVideosDeleted: 0,
    orphanedThumbsDeleted: 0,
    failedPostVideosDeleted: 0,
    expiredVideosDeleted: 0,
    staleJobsReset: 0,
    staleSchedulesReset: 0,
    apiKeysReset: 0,
    cleanupLogsDeleted: 0,
    errors: [],
    bytesFreed: 0,
  };

  // Run all cleanup phases sequentially (each phase is independent but order matters)
  await resetStaleJobs(stats);
  await resetApiKeyStatuses(stats);
  await cleanOrphanedStorageObjects(stats);
  await cleanFailedPostVideos(stats);
  await cleanExpiredVideos(stats);
  await pruneCleanupLogs(stats);
  await deduplicateTopicHistory();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n' + '═'.repeat(62));
  console.log('🛡️  Proteus Cleanup Engine — Summary');
  console.log('═'.repeat(62));
  console.log(`  ⏱  Completed in ${elapsed}s`);
  console.log(`  🗑️  Orphaned videos deleted:    ${stats.orphanedVideosDeleted}`);
  console.log(`  🖼️  Orphaned thumbnails deleted: ${stats.orphanedThumbsDeleted}`);
  console.log(`  ❌  Failed-post videos deleted:  ${stats.failedPostVideosDeleted}`);
  console.log(`  📅  Expired videos deleted:      ${stats.expiredVideosDeleted}`);
  console.log(`  🔄  Stale jobs reset:            ${stats.staleJobsReset}`);
  console.log(`  📋  Stale schedules reset:       ${stats.staleSchedulesReset}`);
  console.log(`  🔑  API keys restored:           ${stats.apiKeysReset}`);
  console.log(`  📜  Old log entries pruned:      ${stats.cleanupLogsDeleted}`);

  if (stats.errors.length > 0) {
    console.log(`\n  ⚠️  Errors (${stats.errors.length}):`);
    stats.errors.forEach(e => console.log(`     - ${e}`));
  } else {
    console.log('  ✅  No errors encountered');
  }

  await logCleanupResult(stats);

  console.log('\n✅ Proteus Cleanup Engine complete.\n');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
