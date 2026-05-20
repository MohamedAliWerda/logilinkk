const path = require('node:path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { CvSubmissionService } = require('../dist/cv_submission/cv-submission.service');
const { getSupabase } = require('../dist/config/supabase.client');

async function pickAuthId(supabase) {
    const { data, error } = await supabase
        .from('cv_submissions')
        .select('id, auth_id, updated_at')
        .not('auth_id', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(25);

    if (error) throw error;

    for (const row of data ? ? []) {
        const { count, error: countErr } = await supabase
            .from('cv_skills')
            .select('*', { count: 'exact', head: true })
            .eq('cv_submission_id', row.id);

        if (countErr) throw countErr;
        if ((count ? ? 0) > 0) {
            return {
                authId: String(row.auth_id),
                cvSubmissionId: String(row.id),
            };
        }
    }

    throw new Error('No cv_submissions with skills found for persistence verification.');
}

async function main() {
    const mode = process.argv[2] || 'force';
    const force = mode === 'force';
    let authId = process.argv[3] || '';
    let cvSubmissionId = '';

    const supabase = getSupabase();

    if (!authId) {
        const picked = await pickAuthId(supabase);
        authId = picked.authId;
        cvSubmissionId = picked.cvSubmissionId;
    }

    const app = await NestFactory.createApplicationContext(AppModule, {
        logger: ['error', 'warn'],
    });

    try {
        const svc = app.get(CvSubmissionService);
        const startedAt = Date.now();
        const result = await svc.getMatchingAnalysis(authId, force);
        const elapsedMs = Date.now() - startedAt;

        const { data: persisted, error: persistedErr } = await supabase
            .from('cv_matching_analysis')
            .select('id, cv_submission_id, analysis_fingerprint, updated_at')
            .eq('auth_id', authId)
            .eq('cv_submission_id', result.cvSubmissionId)
            .limit(1);

        const persistedInfo = persistedErr ? { error: persistedErr.message } :
            (Array.isArray(persisted) && persisted.length > 0 ? persisted[0] : null);

        console.log(
            JSON.stringify({
                    mode,
                    force,
                    authId,
                    cvSubmissionId: result.cvSubmissionId || cvSubmissionId,
                    modelName: result.modelName,
                    summary: result.summary,
                    elapsedMs,
                    persistedInfo,
                },
                null,
                2,
            ),
        );
    } finally {
        await app.close();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});