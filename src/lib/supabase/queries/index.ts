export { getProfile, updateProfile, getProfilesWithAutoSearch, getManualSearchStatus, incrementManualSearch } from "./profiles";
export type { Profile, ProfileUpdate, ManualSearchStatus } from "./profiles";

export { upsertJobs, getJobs, getJobById, dismissJob, getDismissedJobIds, getDismissedJobs, restoreJob, getSeenJobIds } from "./jobs";
export type { JobRow, JobFilters } from "./jobs";

export {
  getApplications,
  getApplicationById,
  createApplication,
  updateApplicationStatus,
  deleteApplication,
  getApplicationStats,
  getStaleApplications,
  getWeeklyStats,
  APPLICATION_STATUSES,
} from "./applications";
export type {
  ApplicationRow,
  ApplicationWithJob,
  ApplicationStatus,
  DashboardStats,
} from "./applications";

export { getScoreMap, getScoresForJobs, upsertScore, getScoreForJob } from "./scores";
export type { ScoreRow, ScoreInsert } from "./scores";

export {
  getPrimaryResume,
  getResumeById,
  getResumes,
  createResume,
  updateResume,
  deleteResume,
} from "./resumes";
export type { ResumeRow, ResumeInsert, ResumeUpdate } from "./resumes";
