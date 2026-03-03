/**
 * Integration tests for Supabase query layer.
 *
 * These tests run against the REAL Supabase instance and require:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * Run with:
 *   npm run test:integration -- supabase-queries
 *
 * The entire suite is skipped when env vars are missing.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// ---------------------------------------------------------------------------
// Load env before anything else
// ---------------------------------------------------------------------------
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

const HAS_SUPABASE =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

// ---------------------------------------------------------------------------
// Conditional imports -- only resolved when tests actually run
// ---------------------------------------------------------------------------
// We import lazily inside beforeAll to avoid module-level errors when
// env vars are missing (getSupabase() throws without them).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let profileQueries: typeof import("@/lib/supabase/queries/profiles");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let jobQueries: typeof import("@/lib/supabase/queries/jobs");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let applicationQueries: typeof import("@/lib/supabase/queries/applications");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let scoreQueries: typeof import("@/lib/supabase/queries/scores");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let resumeQueries: typeof import("@/lib/supabase/queries/resumes");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const USER_ID = "126d2d02-c032-49b0-a2c8-8a7034b6512f";
const TEST_TAG = `__integration_test_${Date.now()}`;

// ---------------------------------------------------------------------------
// Shared test data IDs populated during setup
// ---------------------------------------------------------------------------
let testJobId: string;
let testResumeId: string;
let testApplicationId: string;
let testScoreId: string;
let testSeenJobDismissed = false;

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------
describe.skipIf(!HAS_SUPABASE)("Supabase Query Layer - Integration", () => {
  // -----------------------------------------------------------------------
  // Global setup: dynamic imports + seed a job and resume for FK deps
  // -----------------------------------------------------------------------
  beforeAll(async () => {
    profileQueries = await import("@/lib/supabase/queries/profiles");
    jobQueries = await import("@/lib/supabase/queries/jobs");
    applicationQueries = await import(
      "@/lib/supabase/queries/applications"
    );
    scoreQueries = await import("@/lib/supabase/queries/scores");
    resumeQueries = await import("@/lib/supabase/queries/resumes");
  });

  // -----------------------------------------------------------------------
  // Global teardown: clean up ALL test data in reverse dependency order
  // -----------------------------------------------------------------------
  afterAll(async () => {
    if (!HAS_SUPABASE) return;

    // Use a raw Supabase client for cleanup to avoid relying on query helpers
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Delete match_scores for the test job
    if (testJobId) {
      await supabase
        .from("match_scores")
        .delete()
        .eq("job_listing_id", testJobId);
    }

    // 2. Delete applications for the test job
    if (testJobId) {
      await supabase
        .from("applications")
        .delete()
        .eq("job_listing_id", testJobId);
    }

    // 3. Delete seen_jobs for the test job
    if (testJobId) {
      await supabase
        .from("seen_jobs")
        .delete()
        .eq("job_listing_id", testJobId);
    }

    // 4. Delete the test resume
    if (testResumeId) {
      await supabase.from("resumes").delete().eq("id", testResumeId);
    }

    // 5. Delete the test job listing
    if (testJobId) {
      await supabase.from("job_listings").delete().eq("id", testJobId);
    }

    console.log("[Supabase Integration] Cleanup complete.");
  });

  // =======================================================================
  // 1. Profile tests
  // =======================================================================
  describe("Profiles", () => {
    let originalFullName: string;

    it("getProfile() returns a profile with expected shape", async () => {
      const profile = await profileQueries.getProfile(USER_ID);

      expect(profile).toBeDefined();
      expect(profile.id).toBe(USER_ID);
      expect(typeof profile.full_name).toBe("string");
      expect(typeof profile.email).toBe("string");
      expect(["fr", "en"]).toContain(profile.preferred_language);
      expect(typeof profile.openai_tokens_used).toBe("number");
      expect(typeof profile.openai_tokens_limit).toBe("number");
      expect(profile.created_at).toBeDefined();
      expect(profile.updated_at).toBeDefined();

      originalFullName = profile.full_name;
      console.log(
        `[Profile] Found: ${profile.full_name} (${profile.email})`
      );
    });

    it("updateProfile() updates and returns updated data, then reverts", async () => {
      const tempName = `Test_${TEST_TAG}`;

      // Update to temp name
      const updated = await profileQueries.updateProfile(USER_ID, {
        full_name: tempName,
      });
      expect(updated.full_name).toBe(tempName);
      expect(updated.id).toBe(USER_ID);

      // Revert to original
      const reverted = await profileQueries.updateProfile(USER_ID, {
        full_name: originalFullName,
      });
      expect(reverted.full_name).toBe(originalFullName);

      console.log(
        `[Profile] Updated to "${tempName}", reverted to "${originalFullName}"`
      );
    });
  });

  // =======================================================================
  // 2. Job listing tests
  // =======================================================================
  describe("Job Listings", () => {
    it("upsertJobs() inserts a test job and returns a row with id", async () => {
      const testJob = {
        source: "manual" as const,
        source_id: null,
        source_url: "https://example.com/integration-test",
        dedup_hash: `test_dedup_${TEST_TAG}`,
        title: `Integration Test Job ${TEST_TAG}`,
        company_name: "TestCorp Integration",
        location: "Montreal, QC",
        location_lat: 45.5017,
        location_lng: -73.5673,
        description: "This is an integration test job listing.",
        salary_min: 80000,
        salary_max: 120000,
        salary_currency: "CAD",
        salary_is_predicted: false,
        job_type: "Full-time",
        category: "IT",
        contract_type: "permanent",
        remote_type: "hybrid" as const,
        posted_at: new Date().toISOString(),
        raw_data: { test: true, tag: TEST_TAG },
      };

      const rows = await jobQueries.upsertJobs([testJob]);

      expect(rows).toBeDefined();
      expect(rows.length).toBeGreaterThanOrEqual(1);

      const inserted = rows.find(
        (r) => r.dedup_hash === `test_dedup_${TEST_TAG}`
      );
      expect(inserted).toBeDefined();
      expect(inserted!.id).toBeDefined();
      expect(inserted!.title).toContain("Integration Test Job");

      testJobId = inserted!.id;
      console.log(`[Jobs] Inserted test job: ${testJobId}`);
    });

    it("getJobs() returns an array (may be empty)", async () => {
      const jobs = await jobQueries.getJobs({ limit: 5 });

      expect(Array.isArray(jobs)).toBe(true);
      console.log(`[Jobs] getJobs() returned ${jobs.length} jobs`);
    });

    it("getJobById() returns the inserted test job", async () => {
      expect(testJobId).toBeDefined();

      const job = await jobQueries.getJobById(testJobId);

      expect(job).toBeDefined();
      expect(job.id).toBe(testJobId);
      expect(job.title).toContain("Integration Test Job");
      expect(job.company_name).toBe("TestCorp Integration");
      console.log(`[Jobs] getJobById() returned: "${job.title}"`);
    });

    it("dismissJob() does not throw", async () => {
      expect(testJobId).toBeDefined();

      await expect(
        jobQueries.dismissJob(testJobId)
      ).resolves.not.toThrow();

      testSeenJobDismissed = true;
      console.log(`[Jobs] dismissJob() succeeded for ${testJobId}`);
    });

    it("getDismissedJobIds() returns array containing the dismissed job", async () => {
      expect(testSeenJobDismissed).toBe(true);

      const dismissedIds = await jobQueries.getDismissedJobIds();

      expect(Array.isArray(dismissedIds)).toBe(true);
      expect(dismissedIds).toContain(testJobId);
      console.log(
        `[Jobs] getDismissedJobIds() returned ${dismissedIds.length} ids`
      );
    });
  });

  // =======================================================================
  // 3. Resume setup (needed as FK for scores)
  // =======================================================================
  describe("Resume Setup (for Score FK)", () => {
    it("createResume() inserts a test resume", async () => {
      const resume = await resumeQueries.createResume({
        user_id: USER_ID,
        file_name: `test_resume_${TEST_TAG}.pdf`,
        file_path: `/tmp/test_resume_${TEST_TAG}.pdf`,
        file_type: "pdf",
        raw_text: "Integration test resume content.",
        parsed_data: { test: true, tag: TEST_TAG },
        is_primary: false,
      });

      expect(resume).toBeDefined();
      expect(resume.id).toBeDefined();
      expect(resume.file_name).toContain(TEST_TAG);

      testResumeId = resume.id;
      console.log(`[Resume] Created test resume: ${testResumeId}`);
    });
  });

  // =======================================================================
  // 4. Application tests
  // =======================================================================
  describe("Applications", () => {
    it("createApplication() creates an application for the test job", async () => {
      expect(testJobId).toBeDefined();

      const app = await applicationQueries.createApplication(testJobId);

      expect(app).toBeDefined();
      expect(app.id).toBeDefined();
      expect(app.job_listing_id).toBe(testJobId);
      expect(app.user_id).toBe(USER_ID);
      expect(app.status).toBe("saved");
      expect(app.created_at).toBeDefined();

      testApplicationId = app.id;
      console.log(`[Applications] Created: ${testApplicationId}`);
    });

    it("getApplications() returns array containing the new application", async () => {
      const apps = await applicationQueries.getApplications();

      expect(Array.isArray(apps)).toBe(true);

      const found = apps.find((a) => a.id === testApplicationId);
      expect(found).toBeDefined();
      expect(found!.job_listing_id).toBe(testJobId);
      expect(found!.status).toBe("saved");

      // Verify joined job data shape
      expect(found!.job_listings).toBeDefined();
      if (found!.job_listings) {
        expect(found!.job_listings.title).toContain("Integration Test Job");
      }

      console.log(
        `[Applications] getApplications() returned ${apps.length} total`
      );
    });

    it("updateApplicationStatus() changes status to 'applied'", async () => {
      expect(testApplicationId).toBeDefined();

      const updated = await applicationQueries.updateApplicationStatus(
        testApplicationId,
        "applied"
      );

      expect(updated).toBeDefined();
      expect(updated.id).toBe(testApplicationId);
      expect(updated.status).toBe("applied");
      expect(updated.applied_at).toBeDefined();

      console.log(
        `[Applications] Status updated to: ${updated.status}`
      );
    });

    it("getApplicationStats() returns the expected shape", async () => {
      const stats = await applicationQueries.getApplicationStats();

      expect(stats).toBeDefined();
      expect(typeof stats.activeApplications).toBe("number");
      expect(typeof stats.upcomingInterviews).toBe("number");
      expect(typeof stats.activeJobs).toBe("number");
      expect(typeof stats.avgScore).toBe("number");

      // Our test application is "applied" (not closed), so active >= 1
      expect(stats.activeApplications).toBeGreaterThanOrEqual(1);

      console.log(
        `[Applications] Stats: active=${stats.activeApplications}, ` +
          `interviews=${stats.upcomingInterviews}, ` +
          `activeJobs=${stats.activeJobs}, avgScore=${stats.avgScore}`
      );
    });

    it("deleteApplication() removes the application", async () => {
      expect(testApplicationId).toBeDefined();

      await expect(
        applicationQueries.deleteApplication(testApplicationId)
      ).resolves.not.toThrow();

      // Verify it is gone
      const apps = await applicationQueries.getApplications();
      const found = apps.find((a) => a.id === testApplicationId);
      expect(found).toBeUndefined();

      console.log(
        `[Applications] Deleted: ${testApplicationId}`
      );

      // Clear so afterAll cleanup does not try again
      testApplicationId = "";
    });
  });

  // =======================================================================
  // 5. Score tests
  // =======================================================================
  describe("Match Scores", () => {
    it("upsertScore() inserts a score and returns the row", async () => {
      expect(testJobId).toBeDefined();
      expect(testResumeId).toBeDefined();

      const score = await scoreQueries.upsertScore({
        user_id: USER_ID,
        job_listing_id: testJobId,
        resume_id: testResumeId,
        overall_score: 85,
        skill_match_score: 80,
        experience_match_score: 90,
        education_match_score: 75,
        explanation: `Integration test score for ${TEST_TAG}`,
        matching_skills: ["TypeScript", "React", "Node.js"],
        missing_skills: ["Kubernetes"],
        strengths: ["Strong frontend experience"],
        concerns: ["Limited DevOps experience"],
      });

      expect(score).toBeDefined();
      expect(score.id).toBeDefined();
      expect(score.overall_score).toBe(85);
      expect(score.job_listing_id).toBe(testJobId);
      expect(score.resume_id).toBe(testResumeId);
      expect(score.user_id).toBe(USER_ID);
      expect(score.matching_skills).toContain("TypeScript");

      testScoreId = score.id;
      console.log(
        `[Scores] Upserted score: ${testScoreId} (score=${score.overall_score})`
      );
    });

    it("upsertScore() updates existing score on conflict", async () => {
      expect(testJobId).toBeDefined();
      expect(testResumeId).toBeDefined();

      const updated = await scoreQueries.upsertScore({
        user_id: USER_ID,
        job_listing_id: testJobId,
        resume_id: testResumeId,
        overall_score: 90,
        explanation: `Updated integration test score for ${TEST_TAG}`,
        matching_skills: ["TypeScript", "React", "Node.js", "Docker"],
        missing_skills: [],
        strengths: ["Strong frontend experience", "Docker knowledge"],
        concerns: [],
      });

      expect(updated).toBeDefined();
      expect(updated.overall_score).toBe(90);
      // Same composite key means same row id
      expect(updated.id).toBe(testScoreId);

      console.log(
        `[Scores] Upsert-updated score to ${updated.overall_score}`
      );
    });

    it("getScoreMap() returns a map containing the test job", async () => {
      expect(testJobId).toBeDefined();

      const map = await scoreQueries.getScoreMap([testJobId]);

      expect(map).toBeDefined();
      expect(typeof map).toBe("object");
      expect(map[testJobId]).toBeDefined();
      expect(map[testJobId]).toBe(90);

      console.log(
        `[Scores] getScoreMap() for test job: ${map[testJobId]}`
      );
    });

    it("getScoreMap() returns empty object for empty input", async () => {
      const map = await scoreQueries.getScoreMap([]);
      expect(map).toEqual({});
    });

    it("getScoreForJob() returns the score row", async () => {
      expect(testJobId).toBeDefined();
      expect(testResumeId).toBeDefined();

      const score = await scoreQueries.getScoreForJob(
        testJobId,
        testResumeId
      );

      expect(score).toBeDefined();
      expect(score).not.toBeNull();
      expect(score!.overall_score).toBe(90);
      expect(score!.job_listing_id).toBe(testJobId);
      expect(score!.resume_id).toBe(testResumeId);

      console.log(
        `[Scores] getScoreForJob() returned score=${score!.overall_score}`
      );
    });

    it("getScoreForJob() returns null for non-existent combination", async () => {
      const score = await scoreQueries.getScoreForJob(
        testJobId,
        "00000000-0000-0000-0000-000000000000"
      );

      expect(score).toBeNull();
      console.log(
        "[Scores] getScoreForJob() correctly returned null for non-existent resume"
      );
    });

    it("getScoresForJobs() returns full score rows", async () => {
      expect(testJobId).toBeDefined();

      const scores = await scoreQueries.getScoresForJobs([testJobId]);

      expect(Array.isArray(scores)).toBe(true);
      expect(scores.length).toBeGreaterThanOrEqual(1);

      const found = scores.find((s) => s.job_listing_id === testJobId);
      expect(found).toBeDefined();
      expect(found!.overall_score).toBe(90);
      expect(found!.explanation).toContain(TEST_TAG);

      console.log(
        `[Scores] getScoresForJobs() returned ${scores.length} scores`
      );
    });
  });
});
