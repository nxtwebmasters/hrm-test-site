export interface JobPosting {
  _id: string;
  title: string;
  department?: { _id: string; name: string };
  location?: string;
  employmentType?: string;
  shortDescription?: string;
  requirements?: string[];
  salaryRange?: { min?: number; max?: number; currency?: string };
  hiringManager?: string;
  status?: 'open' | 'closed' | 'draft';
  createdAt?: string;
}

export interface ApplyRequest {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  coverLetter?: string;
  resumeFileKey?: string;
}

export interface CandidateAIStatus {
  candidateId: string;
  aiStatus: 'pending' | 'processing' | 'complete' | 'failed' | 'skipped';
  aiRetryCount: number;
  lastAIError?: {
    message: string;
    timestamp: string;
    retryable: boolean;
  };
  hasAnalysis: boolean;
  extractedSkills: string[];
  seniorityLevel?: 'junior' | 'mid' | 'senior' | 'lead' | 'executive' | 'unknown';
}

export interface AIWorkflowStats {
  statusCounts: {
    pending: number;
    processing: number;
    complete: number;
    failed: number;
    skipped: number;
  };
  retryCounts: Record<string, number>;
  timestamp: string;
}
