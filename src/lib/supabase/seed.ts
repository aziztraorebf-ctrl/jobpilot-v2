import { createHash } from "crypto";
import { getSupabase } from "@/lib/supabase/client";
import { USER_ID } from "@/lib/supabase/constants";
import type { Database } from "@/types/database";

type JobInsert = Database["public"]["Tables"]["job_listings"]["Insert"];
type ApplicationInsert = Database["public"]["Tables"]["applications"]["Insert"];
type MatchScoreInsert = Database["public"]["Tables"]["match_scores"]["Insert"];
type ResumeInsert = Database["public"]["Tables"]["resumes"]["Insert"];

export interface SeedResult {
  jobs: number;
  applications: number;
  scores: number;
}

function dedupHash(title: string, company: string): string {
  return createHash("sha256")
    .update(title + company)
    .digest("hex")
    .substring(0, 16);
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

function futureDate(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

const SEED_JOBS: JobInsert[] = [
  {
    source: "jsearch",
    source_id: "seed-jsearch-001",
    source_url: "https://example.com/jobs/senior-react-dev",
    dedup_hash: dedupHash("Senior React Developer", "Shopify"),
    title: "Senior React Developer",
    company_name: "Shopify",
    location: "Montreal, QC",
    description:
      "Build modern e-commerce UIs with React 19 and Next.js. 5+ years experience required. Strong TypeScript skills.",
    salary_min: 110000,
    salary_max: 145000,
    salary_currency: "CAD",
    salary_is_predicted: false,
    job_type: "fulltime",
    category: "Software Development",
    contract_type: "permanent",
    remote_type: "hybrid",
    posted_at: daysAgo(2),
    raw_data: {},
    is_active: true,
  },
  {
    source: "jsearch",
    source_id: "seed-jsearch-002",
    source_url: "https://example.com/jobs/backend-python",
    dedup_hash: dedupHash("Backend Engineer Python", "Lightspeed Commerce"),
    title: "Backend Engineer Python",
    company_name: "Lightspeed Commerce",
    location: "Montreal, QC",
    description:
      "Design and maintain scalable microservices in Python/FastAPI. Experience with PostgreSQL, Redis, and message queues.",
    salary_min: 100000,
    salary_max: 135000,
    salary_currency: "CAD",
    salary_is_predicted: false,
    job_type: "fulltime",
    category: "Software Development",
    contract_type: "permanent",
    remote_type: "hybrid",
    posted_at: daysAgo(3),
    raw_data: {},
    is_active: true,
  },
  {
    source: "adzuna",
    source_id: "seed-adzuna-001",
    source_url: "https://example.com/jobs/fullstack-dev",
    dedup_hash: dedupHash("Full Stack Developer", "Coveo"),
    title: "Full Stack Developer",
    company_name: "Coveo",
    location: "Montreal, QC",
    description:
      "Work on search technology using React, Node.js, and Elasticsearch. Strong problem-solving skills required.",
    salary_min: 95000,
    salary_max: 125000,
    salary_currency: "CAD",
    salary_is_predicted: true,
    job_type: "fulltime",
    category: "Software Development",
    contract_type: "permanent",
    remote_type: "hybrid",
    posted_at: daysAgo(5),
    raw_data: {},
    is_active: true,
  },
  {
    source: "jsearch",
    source_id: "seed-jsearch-003",
    source_url: "https://example.com/jobs/devops-engineer",
    dedup_hash: dedupHash("DevOps Engineer", "Element AI"),
    title: "DevOps Engineer",
    company_name: "Element AI",
    location: "Montreal, QC",
    description:
      "Manage CI/CD pipelines, Kubernetes clusters, and cloud infrastructure on AWS/GCP. Terraform and Ansible experience required.",
    salary_min: 105000,
    salary_max: 140000,
    salary_currency: "CAD",
    salary_is_predicted: false,
    job_type: "fulltime",
    category: "DevOps",
    contract_type: "permanent",
    remote_type: "remote",
    posted_at: daysAgo(1),
    raw_data: {},
    is_active: true,
  },
  {
    source: "adzuna",
    source_id: "seed-adzuna-002",
    source_url: "https://example.com/jobs/data-analyst",
    dedup_hash: dedupHash("Data Analyst", "National Bank of Canada"),
    title: "Data Analyst",
    company_name: "National Bank of Canada",
    location: "Toronto, ON",
    description:
      "Analyze financial data using SQL, Python, and Tableau. Build dashboards and reports for business stakeholders.",
    salary_min: 75000,
    salary_max: 95000,
    salary_currency: "CAD",
    salary_is_predicted: true,
    job_type: "fulltime",
    category: "Data & Analytics",
    contract_type: "permanent",
    remote_type: "onsite",
    posted_at: daysAgo(4),
    raw_data: {},
    is_active: true,
  },
  {
    source: "jsearch",
    source_id: "seed-jsearch-004",
    source_url: "https://example.com/jobs/ml-engineer",
    dedup_hash: dedupHash("Machine Learning Engineer", "Mila"),
    title: "Machine Learning Engineer",
    company_name: "Mila",
    location: "Montreal, QC",
    description:
      "Research and deploy ML models for NLP and computer vision. PyTorch, transformers, and MLOps experience preferred.",
    salary_min: 120000,
    salary_max: 160000,
    salary_currency: "CAD",
    salary_is_predicted: false,
    job_type: "fulltime",
    category: "Machine Learning",
    contract_type: "permanent",
    remote_type: "hybrid",
    posted_at: daysAgo(6),
    raw_data: {},
    is_active: true,
  },
  {
    source: "manual",
    source_url: "https://example.com/jobs/frontend-lead",
    dedup_hash: dedupHash("Frontend Lead", "Ubisoft Montreal"),
    title: "Frontend Lead",
    company_name: "Ubisoft Montreal",
    location: "Montreal, QC",
    description:
      "Lead a team of frontend developers building internal tools. React, TypeScript, and mentoring experience required.",
    salary_min: 115000,
    salary_max: 150000,
    salary_currency: "CAD",
    salary_is_predicted: false,
    job_type: "fulltime",
    category: "Software Development",
    contract_type: "permanent",
    remote_type: "onsite",
    posted_at: daysAgo(7),
    raw_data: {},
    is_active: true,
  },
  {
    source: "jsearch",
    source_id: "seed-jsearch-005",
    source_url: "https://example.com/jobs/cloud-architect",
    dedup_hash: dedupHash("Cloud Solutions Architect", "AWS"),
    title: "Cloud Solutions Architect",
    company_name: "AWS",
    location: "Vancouver, BC",
    description:
      "Help enterprise customers design cloud architectures. AWS certifications and 8+ years experience required.",
    salary_min: 140000,
    salary_max: 190000,
    salary_currency: "CAD",
    salary_is_predicted: false,
    job_type: "fulltime",
    category: "Cloud & Infrastructure",
    contract_type: "permanent",
    remote_type: "hybrid",
    posted_at: daysAgo(3),
    raw_data: {},
    is_active: true,
  },
  {
    source: "adzuna",
    source_id: "seed-adzuna-003",
    source_url: "https://example.com/jobs/qa-engineer",
    dedup_hash: dedupHash("QA Automation Engineer", "CAE"),
    title: "QA Automation Engineer",
    company_name: "CAE",
    location: "Montreal, QC",
    description:
      "Build and maintain automated test suites using Playwright and Cypress. Experience with CI/CD integration required.",
    salary_min: 80000,
    salary_max: 105000,
    salary_currency: "CAD",
    salary_is_predicted: true,
    job_type: "fulltime",
    category: "Quality Assurance",
    contract_type: "permanent",
    remote_type: "hybrid",
    posted_at: daysAgo(8),
    raw_data: {},
    is_active: true,
  },
  {
    source: "jsearch",
    source_id: "seed-jsearch-006",
    source_url: "https://example.com/jobs/product-manager",
    dedup_hash: dedupHash("Technical Product Manager", "Wealthsimple"),
    title: "Technical Product Manager",
    company_name: "Wealthsimple",
    location: "Toronto, ON",
    description:
      "Drive product strategy for fintech platform. Technical background and experience with Agile methodologies required.",
    salary_min: 110000,
    salary_max: 145000,
    salary_currency: "CAD",
    salary_is_predicted: false,
    job_type: "fulltime",
    category: "Product Management",
    contract_type: "permanent",
    remote_type: "remote",
    posted_at: daysAgo(2),
    raw_data: {},
    is_active: true,
  },
  {
    source: "manual",
    source_url: "https://example.com/jobs/security-engineer",
    dedup_hash: dedupHash("Security Engineer", "Desjardins"),
    title: "Security Engineer",
    company_name: "Desjardins",
    location: "Montreal, QC",
    description:
      "Protect financial systems through penetration testing, security audits, and incident response. CISSP or equivalent preferred.",
    salary_min: 100000,
    salary_max: 130000,
    salary_currency: "CAD",
    salary_is_predicted: false,
    job_type: "fulltime",
    category: "Security",
    contract_type: "permanent",
    remote_type: "onsite",
    posted_at: daysAgo(10),
    raw_data: {},
    is_active: true,
  },
  {
    source: "jsearch",
    source_id: "seed-jsearch-007",
    source_url: "https://example.com/jobs/mobile-dev",
    dedup_hash: dedupHash("Mobile Developer React Native", "Hopper"),
    title: "Mobile Developer React Native",
    company_name: "Hopper",
    location: "Montreal, QC",
    description:
      "Build cross-platform mobile experiences for travel booking. React Native and native iOS/Android knowledge a plus.",
    salary_min: 95000,
    salary_max: 130000,
    salary_currency: "CAD",
    salary_is_predicted: false,
    job_type: "fulltime",
    category: "Mobile Development",
    contract_type: "permanent",
    remote_type: "remote",
    posted_at: daysAgo(4),
    raw_data: {},
    is_active: true,
  },
  {
    source: "adzuna",
    source_id: "seed-adzuna-004",
    source_url: "https://example.com/jobs/data-engineer",
    dedup_hash: dedupHash("Data Engineer", "Intact Financial"),
    title: "Data Engineer",
    company_name: "Intact Financial",
    location: "Toronto, ON",
    description:
      "Design data pipelines with Spark, Airflow, and dbt. Experience with data warehousing and lakehouse architectures required.",
    salary_min: 100000,
    salary_max: 135000,
    salary_currency: "CAD",
    salary_is_predicted: true,
    job_type: "fulltime",
    category: "Data Engineering",
    contract_type: "permanent",
    remote_type: "hybrid",
    posted_at: daysAgo(5),
    raw_data: {},
    is_active: true,
  },
  {
    source: "jsearch",
    source_id: "seed-jsearch-008",
    source_url: "https://example.com/jobs/sre",
    dedup_hash: dedupHash("Site Reliability Engineer", "CircleCI"),
    title: "Site Reliability Engineer",
    company_name: "CircleCI",
    location: "Remote, Canada",
    description:
      "Ensure platform reliability at scale. Kubernetes, observability (Datadog/Prometheus), and Go experience preferred.",
    salary_min: 115000,
    salary_max: 155000,
    salary_currency: "CAD",
    salary_is_predicted: false,
    job_type: "fulltime",
    category: "DevOps",
    contract_type: "permanent",
    remote_type: "remote",
    posted_at: daysAgo(1),
    raw_data: {},
    is_active: true,
  },
  {
    source: "manual",
    source_url: "https://example.com/jobs/tech-writer",
    dedup_hash: dedupHash("Technical Writer", "Confluent"),
    title: "Technical Writer",
    company_name: "Confluent",
    location: "Remote, Canada",
    description:
      "Write developer documentation for streaming data platform. Experience with Kafka, REST APIs, and docs-as-code workflows.",
    salary_min: 80000,
    salary_max: 110000,
    salary_currency: "CAD",
    salary_is_predicted: false,
    job_type: "fulltime",
    category: "Technical Writing",
    contract_type: "contract",
    remote_type: "remote",
    posted_at: daysAgo(9),
    raw_data: {},
    is_active: true,
  },
];

// Indices into SEED_JOBS for applications (0-based)
// 8 applications with varied statuses
const APPLICATION_SPECS: Array<{
  jobIndex: number;
  status: ApplicationInsert["status"];
  applied_at?: string;
  interview_at?: string;
  offer_at?: string;
  closed_at?: string;
  notes?: string;
  salary_offered?: number;
  priority?: number;
}> = [
  // 2 saved
  {
    jobIndex: 0,
    status: "saved",
    notes: "Great match for my React skills",
    priority: 3,
  },
  {
    jobIndex: 4,
    status: "saved",
    notes: "Interesting data role, review later",
    priority: 1,
  },
  // 2 applied
  {
    jobIndex: 1,
    status: "applied",
    applied_at: daysAgo(5),
    notes: "Applied via company career page",
    priority: 2,
  },
  {
    jobIndex: 2,
    status: "applied",
    applied_at: daysAgo(3),
    notes: "Recruiter reached out on LinkedIn",
    priority: 2,
  },
  // 1 interview
  {
    jobIndex: 3,
    status: "interview",
    applied_at: daysAgo(10),
    interview_at: futureDate(3),
    notes: "Technical interview scheduled - system design focus",
    priority: 3,
  },
  // 1 offer
  {
    jobIndex: 5,
    status: "offer",
    applied_at: daysAgo(20),
    interview_at: daysAgo(10),
    offer_at: daysAgo(1),
    notes: "Verbal offer received, waiting for written",
    salary_offered: 135000,
    priority: 3,
  },
  // 1 rejected
  {
    jobIndex: 6,
    status: "rejected",
    applied_at: daysAgo(15),
    interview_at: daysAgo(7),
    closed_at: daysAgo(2),
    notes: "Rejected after second round - team fit concerns",
    priority: 1,
  },
  // 1 accepted
  {
    jobIndex: 7,
    status: "accepted",
    applied_at: daysAgo(25),
    interview_at: daysAgo(15),
    offer_at: daysAgo(5),
    closed_at: daysAgo(1),
    notes: "Signed the offer letter",
    salary_offered: 160000,
    priority: 3,
  },
];

// Indices into SEED_JOBS for match scores
const SCORE_SPECS: Array<{
  jobIndex: number;
  overall_score: number;
  skill_match_score: number;
  experience_match_score: number;
  education_match_score: number;
  explanation: string;
  matching_skills: string[];
  missing_skills: string[];
  strengths: string[];
  concerns: string[];
}> = [
  {
    jobIndex: 0,
    overall_score: 92,
    skill_match_score: 95,
    experience_match_score: 88,
    education_match_score: 90,
    explanation: "Strong React and TypeScript experience aligns well with this role.",
    matching_skills: ["React", "TypeScript", "Next.js", "CSS-in-JS"],
    missing_skills: ["GraphQL"],
    strengths: ["5+ years frontend experience", "Strong portfolio"],
    concerns: ["No e-commerce background"],
  },
  {
    jobIndex: 1,
    overall_score: 78,
    skill_match_score: 72,
    experience_match_score: 80,
    education_match_score: 85,
    explanation: "Solid backend skills but Python experience is secondary to JavaScript.",
    matching_skills: ["Python", "PostgreSQL", "REST APIs"],
    missing_skills: ["FastAPI", "Redis", "RabbitMQ"],
    strengths: ["Backend architecture experience"],
    concerns: ["Python not primary language", "No microservices at scale"],
  },
  {
    jobIndex: 2,
    overall_score: 85,
    skill_match_score: 88,
    experience_match_score: 82,
    education_match_score: 80,
    explanation: "Full stack profile is a strong match. Search technology experience is a bonus.",
    matching_skills: ["React", "Node.js", "TypeScript", "REST APIs"],
    missing_skills: ["Elasticsearch"],
    strengths: ["Full stack experience", "Strong problem-solving"],
    concerns: ["No search engine experience"],
  },
  {
    jobIndex: 3,
    overall_score: 65,
    skill_match_score: 60,
    experience_match_score: 68,
    education_match_score: 70,
    explanation: "Some DevOps knowledge but lacks deep infrastructure experience.",
    matching_skills: ["Docker", "CI/CD", "Git"],
    missing_skills: ["Kubernetes", "Terraform", "Ansible", "AWS"],
    strengths: ["CI/CD pipeline experience"],
    concerns: ["No production Kubernetes experience", "Limited cloud certifications"],
  },
  {
    jobIndex: 5,
    overall_score: 88,
    skill_match_score: 85,
    experience_match_score: 90,
    education_match_score: 88,
    explanation: "ML fundamentals are strong and PyTorch experience is relevant.",
    matching_skills: ["Python", "PyTorch", "NLP", "Data pipelines"],
    missing_skills: ["MLOps", "Kubernetes for ML"],
    strengths: ["Research background", "Published papers"],
    concerns: ["Production ML deployment limited"],
  },
  {
    jobIndex: 6,
    overall_score: 82,
    skill_match_score: 85,
    experience_match_score: 78,
    education_match_score: 80,
    explanation: "Strong frontend skills and team leadership potential.",
    matching_skills: ["React", "TypeScript", "Code reviews", "Mentoring"],
    missing_skills: ["Internal tooling experience"],
    strengths: ["Technical leadership", "Strong communication"],
    concerns: ["No gaming industry background"],
  },
  {
    jobIndex: 8,
    overall_score: 71,
    skill_match_score: 75,
    experience_match_score: 68,
    education_match_score: 70,
    explanation: "Testing knowledge is solid but automation tooling could be deeper.",
    matching_skills: ["Playwright", "Jest", "CI/CD"],
    missing_skills: ["Cypress", "Performance testing", "Mobile testing"],
    strengths: ["Test-driven mindset"],
    concerns: ["Limited automation framework experience"],
  },
  {
    jobIndex: 9,
    overall_score: 55,
    skill_match_score: 50,
    experience_match_score: 58,
    education_match_score: 60,
    explanation: "Technical background is good but lacks product management experience.",
    matching_skills: ["Technical skills", "Agile basics"],
    missing_skills: ["Product roadmapping", "Stakeholder management", "Metrics-driven"],
    strengths: ["Strong technical understanding"],
    concerns: ["No PM experience", "No fintech domain knowledge"],
  },
  {
    jobIndex: 11,
    overall_score: 45,
    skill_match_score: 40,
    experience_match_score: 48,
    education_match_score: 50,
    explanation: "Security is not a primary skill area. Significant gap.",
    matching_skills: ["Linux", "Networking basics"],
    missing_skills: ["Penetration testing", "CISSP", "Incident response", "SIEM"],
    strengths: ["General awareness of security best practices"],
    concerns: ["No security certifications", "No hands-on security audit experience"],
  },
  {
    jobIndex: 13,
    overall_score: 73,
    skill_match_score: 70,
    experience_match_score: 75,
    education_match_score: 74,
    explanation: "Data pipeline basics are there but specific tooling needs growth.",
    matching_skills: ["SQL", "Python", "Data modeling"],
    missing_skills: ["Spark", "Airflow", "dbt", "Data lakehouse"],
    strengths: ["Strong SQL and data modeling"],
    concerns: ["No large-scale data pipeline experience"],
  },
];

// Seed resume placeholder (required for match_scores FK)
const SEED_RESUME: ResumeInsert = {
  user_id: USER_ID,
  file_name: "seed-resume.pdf",
  file_path: "seed/seed-resume.pdf",
  file_type: "pdf",
  raw_text: "Seed resume for development testing. Full stack developer with 5+ years experience in React, TypeScript, Node.js, Python.",
  parsed_data: {
    name: "Test User",
    skills: ["React", "TypeScript", "Node.js", "Python", "PostgreSQL", "Docker"],
    experience_years: 5,
  },
  is_primary: true,
};

export async function seedDatabase(): Promise<SeedResult> {
  const supabase = getSupabase();

  // Step 1: Insert seed resume (needed for match_scores FK)
  // Use upsert-like logic: check if seed resume already exists
  const { data: existingResume } = await supabase
    .from("resumes")
    .select("id")
    .eq("user_id", USER_ID)
    .eq("file_name", "seed-resume.pdf")
    .maybeSingle();

  let resumeId: string;

  if (existingResume) {
    resumeId = existingResume.id;
  } else {
    const { data: newResume, error: resumeError } = await supabase
      .from("resumes")
      .insert(SEED_RESUME)
      .select("id")
      .single();

    if (resumeError) {
      throw new Error(`Failed to insert seed resume: ${resumeError.message}`);
    }

    resumeId = newResume.id;
  }

  // Step 2: Insert jobs - check for existing dedup_hashes first
  const inputHashes = SEED_JOBS.map((j) => j.dedup_hash);

  const { data: existingJobs, error: existingJobsError } = await supabase
    .from("job_listings")
    .select("id, dedup_hash")
    .in("dedup_hash", inputHashes);

  if (existingJobsError) {
    throw new Error(`Failed to check existing jobs: ${existingJobsError.message}`);
  }

  const existingHashMap = new Map<string, string>();
  for (const row of existingJobs ?? []) {
    existingHashMap.set(row.dedup_hash, row.id);
  }

  const newJobs = SEED_JOBS.filter((j) => !existingHashMap.has(j.dedup_hash));
  let insertedJobCount = 0;

  if (newJobs.length > 0) {
    const { data: inserted, error: insertError } = await supabase
      .from("job_listings")
      .insert(newJobs)
      .select("id, dedup_hash");

    if (insertError) {
      throw new Error(`Failed to insert seed jobs: ${insertError.message}`);
    }

    for (const row of inserted ?? []) {
      existingHashMap.set(row.dedup_hash, row.id);
    }

    insertedJobCount = inserted?.length ?? 0;
  }

  // Build a lookup: jobIndex -> job UUID
  const jobIdByIndex = new Map<number, string>();
  for (let i = 0; i < SEED_JOBS.length; i++) {
    const id = existingHashMap.get(SEED_JOBS[i].dedup_hash);
    if (id) {
      jobIdByIndex.set(i, id);
    }
  }

  // Step 3: Insert applications
  // First check which job_listing_ids already have applications for this user
  const appJobIds = APPLICATION_SPECS.map((spec) => jobIdByIndex.get(spec.jobIndex)).filter(
    (id): id is string => id !== undefined
  );

  let existingAppJobIds = new Set<string>();

  if (appJobIds.length > 0) {
    const { data: existingApps, error: existingAppsError } = await supabase
      .from("applications")
      .select("job_listing_id")
      .eq("user_id", USER_ID)
      .in("job_listing_id", appJobIds);

    if (existingAppsError) {
      throw new Error(`Failed to check existing applications: ${existingAppsError.message}`);
    }

    existingAppJobIds = new Set(
      (existingApps ?? []).map((a) => a.job_listing_id)
    );
  }

  const newApplications: Array<
    ApplicationInsert & {
      applied_at?: string;
      interview_at?: string;
      offer_at?: string;
      closed_at?: string;
    }
  > = [];

  for (const spec of APPLICATION_SPECS) {
    const jobId = jobIdByIndex.get(spec.jobIndex);
    if (!jobId || existingAppJobIds.has(jobId)) {
      continue;
    }

    newApplications.push({
      user_id: USER_ID,
      job_listing_id: jobId,
      status: spec.status,
      notes: spec.notes ?? null,
      salary_offered: spec.salary_offered ?? null,
      priority: spec.priority ?? 1,
      // Timestamp fields handled via the insert since we want specific dates
      ...(spec.applied_at && { applied_at: spec.applied_at }),
      ...(spec.interview_at && { interview_at: spec.interview_at }),
      ...(spec.offer_at && { offer_at: spec.offer_at }),
      ...(spec.closed_at && { closed_at: spec.closed_at }),
    });
  }

  let insertedAppCount = 0;
  if (newApplications.length > 0) {
    const { data: insertedApps, error: appInsertError } = await supabase
      .from("applications")
      .insert(newApplications)
      .select("id");

    if (appInsertError) {
      throw new Error(`Failed to insert seed applications: ${appInsertError.message}`);
    }

    insertedAppCount = insertedApps?.length ?? 0;
  }

  // Step 4: Insert match scores
  // Check which scores already exist for this user + resume + job combo
  const scoreJobIds = SCORE_SPECS.map((spec) => jobIdByIndex.get(spec.jobIndex)).filter(
    (id): id is string => id !== undefined
  );

  let existingScoreJobIds = new Set<string>();

  if (scoreJobIds.length > 0) {
    const { data: existingScores, error: existingScoresError } = await supabase
      .from("match_scores")
      .select("job_listing_id")
      .eq("user_id", USER_ID)
      .eq("resume_id", resumeId)
      .in("job_listing_id", scoreJobIds);

    if (existingScoresError) {
      throw new Error(`Failed to check existing scores: ${existingScoresError.message}`);
    }

    existingScoreJobIds = new Set(
      (existingScores ?? []).map((s) => s.job_listing_id)
    );
  }

  const newScores: MatchScoreInsert[] = [];

  for (const spec of SCORE_SPECS) {
    const jobId = jobIdByIndex.get(spec.jobIndex);
    if (!jobId || existingScoreJobIds.has(jobId)) {
      continue;
    }

    newScores.push({
      user_id: USER_ID,
      job_listing_id: jobId,
      resume_id: resumeId,
      overall_score: spec.overall_score,
      skill_match_score: spec.skill_match_score,
      experience_match_score: spec.experience_match_score,
      education_match_score: spec.education_match_score,
      explanation: spec.explanation,
      matching_skills: spec.matching_skills,
      missing_skills: spec.missing_skills,
      strengths: spec.strengths,
      concerns: spec.concerns,
    });
  }

  let insertedScoreCount = 0;
  if (newScores.length > 0) {
    const { data: insertedScores, error: scoreInsertError } = await supabase
      .from("match_scores")
      .insert(newScores)
      .select("id");

    if (scoreInsertError) {
      throw new Error(`Failed to insert seed scores: ${scoreInsertError.message}`);
    }

    insertedScoreCount = insertedScores?.length ?? 0;
  }

  return {
    jobs: insertedJobCount,
    applications: insertedAppCount,
    scores: insertedScoreCount,
  };
}
