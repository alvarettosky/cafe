/**
 * Cleanup old backups based on retention policy
 * Policy:
 * - Daily: Keep last 7 days
 * - Weekly: Keep last 4 weeks (Sunday backups)
 * - Monthly: Keep last 12 months (1st of month backups)
 */

import { listBackups, deleteBackup } from './upload-supabase';

interface RetentionPolicy {
    daily: number; // Days to keep daily backups
    weekly: number; // Weeks to keep weekly backups
    monthly: number; // Months to keep monthly backups
}

const DEFAULT_POLICY: RetentionPolicy = {
    daily: 7,
    weekly: 4,
    monthly: 12,
};

interface CleanupResult {
    success: boolean;
    kept: string[];
    deleted: string[];
    errors: string[];
}

export async function cleanupBackups(policy: RetentionPolicy = DEFAULT_POLICY): Promise<CleanupResult> {
    console.log('Starting backup cleanup...');
    console.log(`  Policy: Daily=${policy.daily}d, Weekly=${policy.weekly}w, Monthly=${policy.monthly}m`);

    const result: CleanupResult = {
        success: true,
        kept: [],
        deleted: [],
        errors: [],
    };

    try {
        // Get all backups (increase limit to get full history)
        const backups = await listBackups(500);
        console.log(`  Found ${backups.length} backup files`);

        const now = new Date();
        const dailyCutoff = new Date(now.getTime() - policy.daily * 24 * 60 * 60 * 1000);
        const weeklyCutoff = new Date(now.getTime() - policy.weekly * 7 * 24 * 60 * 60 * 1000);
        const monthlyCutoff = new Date(now.getTime() - policy.monthly * 30 * 24 * 60 * 60 * 1000);

        for (const backup of backups) {
            const createdDate = new Date(backup.createdAt);
            const dayOfWeek = createdDate.getDay(); // 0 = Sunday
            const dayOfMonth = createdDate.getDate();

            let shouldKeep = false;
            let reason = '';

            // Check retention rules
            if (createdDate >= dailyCutoff) {
                // Within daily retention period
                shouldKeep = true;
                reason = 'daily';
            } else if (createdDate >= weeklyCutoff && dayOfWeek === 0) {
                // Sunday backup within weekly retention
                shouldKeep = true;
                reason = 'weekly';
            } else if (createdDate >= monthlyCutoff && dayOfMonth === 1) {
                // 1st of month backup within monthly retention
                shouldKeep = true;
                reason = 'monthly';
            }

            if (shouldKeep) {
                console.log(`  Keep (${reason}): ${backup.name}`);
                result.kept.push(backup.name);
            } else {
                console.log(`  Delete: ${backup.name}`);
                const deleted = await deleteBackup(backup.name);
                if (deleted) {
                    result.deleted.push(backup.name);
                } else {
                    result.errors.push(backup.name);
                    result.success = false;
                }
            }
        }

        console.log(`\nCleanup complete!`);
        console.log(`  Kept: ${result.kept.length}`);
        console.log(`  Deleted: ${result.deleted.length}`);
        console.log(`  Errors: ${result.errors.length}`);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('Cleanup failed:', errorMessage);
        result.success = false;
        result.errors.push(errorMessage);
    }

    return result;
}

// Run if called directly
if (require.main === module) {
    cleanupBackups()
        .then((result) => {
            if (!result.success) {
                process.exit(1);
            }
        })
        .catch((err) => {
            console.error('Cleanup failed:', err);
            process.exit(1);
        });
}
