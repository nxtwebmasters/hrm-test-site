# Job Postings — Candidate Frontend Guide (Complete)

This guide covers a complete candidate-side hiring flow for a single-page frontend (Angular recommended, but plain JS examples included):
- List job postings (search & pagination)
- View job details
- Upload resume (public, unauthenticated)
- Apply to a job with or without file uploads
- Track AI analysis status for applications

The guide includes copy-pasteable examples for Angular (service + component) and plain fetch-based code for quick testing.

## Enhanced AI Workflow Features (NEW)

The backend now includes an intelligent AI workflow system that automatically processes candidate applications:

### Automatic AI Processing
- **Resume Analysis**: Automatic parsing and AI analysis of uploaded resumes
- **Job Matching**: Intelligent matching between candidate skills and job requirements
- **Scoring**: AI-generated compatibility scores for applications
- **Status Tracking**: Real-time status updates throughout the AI processing pipeline

### AI Status Values
Applications now have an `aiStatus` field with the following possible values:
- `pending` - Queued for AI processing
- `processing` - Currently being analyzed by AI
- `complete` - AI analysis completed successfully
- `failed` - AI processing failed (may be retried)
- `skipped` - No resume provided, AI analysis skipped

### Retry Logic
- Automatic retry for transient failures (network issues, timeouts)
- Smart error classification (retryable vs permanent failures)
- Up to 3 automatic retry attempts with exponential backoff
- Manual retry capability for failed processes

Quick API summary (backend)
---------------------------
- GET `/api/hiring/postings` — list job postings. Supports query params: `page`, `pageSize`, `search`, `status`.
- GET `/api/hiring/postings/:id` — get a single job posting's details.
- POST `/api/hiring/postings/:id/apply` — submit application (public). Body accepts applicant fields and optional `resumeFileKey`.
- POST `/api/hiring/postings/:id/apply-with-files` — multipart endpoint for candidate apply with file uploads (public route handled in router).
- POST `/api/files/upload/public` — public file upload endpoint (returns file record including `fileKey`). Use this to upload resume before applying or if your apply flow requires separate upload.

### NEW: AI Workflow Management Endpoints
- GET `/api/ai-workflow/candidates/:id/status` — get AI processing status for a candidate
- POST `/api/ai-workflow/candidates/:id/queue` — manually queue AI processing (admin)
- GET `/api/ai-workflow/stats` — get overall AI workflow statistics (admin)
- POST `/api/ai-workflow/retry-failed` — retry all failed AI workflows (admin)

Notes
- The backend now validates job posting IDs and will return 400 for invalid IDs instead of throwing server errors. Still ensure your frontend never calls `/postings/undefined` (see defensive checks below).
- CORS: set frontend origin in backend config (e.g., `CORS_ORIGIN=http://localhost:4200`).
- **AI Processing**: Applications are automatically queued for AI analysis when a resume is provided. The process is asynchronous and non-blocking.
- **File Relations**: The system now properly handles file-to-candidate relationships, ensuring AI can access uploaded resumes.
- **Error Recovery**: Failed AI processing attempts are automatically retried with intelligent backoff strategies.

Minimal TypeScript interfaces
-----------------------------
Create `src/app/models/job.ts`

```ts
export interface JobPosting {
  _id: string;
  title: string;
  department?: { _id: string; name: string };
  location?: string;
  employmentType?: string;
  shortDescription?: string;
  description?: string;
  requirements?: string[];
  salaryRange?: { min?: number; max?: number; currency?: string };
  hiringManager?: any;
  status?: 'open' | 'closed' | 'draft';
  createdAt?: string;
}

export interface ApplyRequest {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  coverLetter?: string;
  resumeFileKey?: string; // fileKey returned from public upload
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
```

Frontend contract (tiny)
- Inputs: job list query params, selected job id, applicant form fields, optional resume file
- Outputs: job list, job details, application result
- Error modes: invalid job id (400), missing required fields (400), auth required (401) for protected endpoints, server error (500)

Client defensive checklist (do in UI before calling backend)
- Ensure jobId exists and looks like an ObjectId: /^[0-9a-fA-F]{24}$/
- Validate required applicant fields before submit
- Enforce file types and max size (10MB) on client
- Show progress & disable submit while uploading

Angular: JobService + FileService
--------------------------------
File service for public upload: `src/app/services/file.service.ts`

```ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class FileService {
  private base = '/api';
  constructor(private http: HttpClient) {}

  uploadPublicFile(file: File): Observable<HttpEvent<any>> {
    const url = `${this.base}/files/upload/public`;
    const form = new FormData();
    form.append('file', file, file.name);
    const req = new HttpRequest('POST', url, form, { reportProgress: true });
    return this.http.request(req);
  }
}
```

Job service: `src/app/services/job.service.ts`

```ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { JobPosting, ApplyRequest } from '../models/job';

@Injectable({ providedIn: 'root' })
export class JobService {
  private base = '/api/hiring';
  private aiBase = '/api/ai-workflow';
  constructor(private http: HttpClient) {}

  listJobs(params?: any): Observable<any> {
    return this.http.get(`${this.base}/postings`, { params });
  }

  getJob(id: string): Observable<any> {
    return this.http.get(`${this.base}/postings/${id}`);
  }

  applyToJob(jobId: string, payload: ApplyRequest): Observable<any> {
    return this.http.post(`${this.base}/postings/${jobId}/apply`, payload);
  }

  applyWithFiles(jobId: string, formData: FormData): Observable<any> {
    return this.http.post(`${this.base}/postings/${jobId}/apply-with-files`, formData);
  }

  // NEW: AI Workflow Methods
  getCandidateAIStatus(candidateId: string): Observable<any> {
    return this.http.get(`${this.aiBase}/candidates/${candidateId}/status`);
  }

  getAIWorkflowStats(): Observable<any> {
    return this.http.get(`${this.aiBase}/stats`);
  }

  retryFailedAIWorkflows(limit: number = 10): Observable<any> {
    return this.http.post(`${this.aiBase}/retry-failed`, { limit });
  }
}
```

Angular component: Apply flow (upload then apply)
------------------------------------------------
This snippet shows uploading a resume via `FileService.uploadPublicFile` then calling `JobService.applyToJob` with the returned `fileKey`. It also demonstrates tracking AI processing status.

```ts
// Example: src/app/components/job-apply/job-apply.component.ts
import { Component } from '@angular/core';
import { FileService } from '../../services/file.service';
import { JobService } from '../../services/job.service';
import { HttpEventType } from '@angular/common/http';
import { interval, takeWhile } from 'rxjs';

@Component({ 
  selector: 'app-job-apply', 
  template: `\
    <input type="file" (change)="onFileSelected($event)" />\
    <button (click)="apply()" [disabled]="isSubmitting">Apply</button>\
    <div *ngIf="progress >= 0">Upload: {{progress}}%</div>\
    <div *ngIf="applicationResult">
      <p>Application submitted successfully!</p>
      <div *ngIf="candidateId">
        <h4>AI Processing Status</h4>
        <p>Status: {{aiStatus?.aiStatus}}</p>
        <p *ngIf="aiStatus?.aiRetryCount > 0">Retry attempts: {{aiStatus.aiRetryCount}}</p>
        <div *ngIf="aiStatus?.aiStatus === 'complete' && aiStatus?.extractedSkills?.length">
          <p>Extracted skills: {{aiStatus.extractedSkills.join(', ')}}</p>
          <p>Seniority level: {{aiStatus.seniorityLevel}}</p>
        </div>
        <div *ngIf="aiStatus?.aiStatus === 'failed'" class="error">
          <p>AI processing failed: {{aiStatus.lastAIError?.message}}</p>
          <p *ngIf="aiStatus.lastAIError?.retryable">This will be retried automatically.</p>
        </div>
      </div>
    </div>` 
})
export class JobApplyComponent {
  selectedFile?: File;
  progress = -1;
  isSubmitting = false;
  jobId = ''; // set dynamically
  applicationResult?: any;
  candidateId?: string;
  aiStatus?: any;

  constructor(private fileService: FileService, private jobService: JobService) {}

  onFileSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length) this.selectedFile = input.files[0];
  }

  uploadAndApply(applicant: any) {
    if (!this.selectedFile) return this.applyWithoutFile(applicant);
    this.progress = 0;
    this.fileService.uploadPublicFile(this.selectedFile).subscribe({
      next: event => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.progress = Math.round((100 * event.loaded) / event.total);
        } else if (event.type === HttpEventType.Response) {
          const body = event.body?.data || event.body;
          const resumeFileKey = body?.fileKey || body?.file?.fileKey || body?.data?.fileKey;
          this.applyWithResume(applicant, resumeFileKey);
        }
      },
      error: err => { console.error('Upload failed', err); this.progress = -1; }
    });
  }

  applyWithResume(applicant: any, resumeFileKey?: string) {
    this.isSubmitting = true;
    const payload = { ...applicant, resumeFileKey };
    this.jobService.applyToJob(this.jobId, payload).subscribe({ 
      next: result => {
        console.log('Applied', result);
        this.applicationResult = result;
        this.candidateId = result.data?._id;
        this.isSubmitting = false;
        if (this.candidateId) {
          this.startAIStatusPolling();
        }
      }, 
      error: e => {
        console.error(e);
        this.isSubmitting = false;
      }
    });
  }

  applyWithoutFile(applicant: any) {
    this.isSubmitting = true;
    this.jobService.applyToJob(this.jobId, applicant).subscribe({ 
      next: result => {
        console.log('Applied', result);
        this.applicationResult = result;
        this.candidateId = result.data?._id;
        this.isSubmitting = false;
        if (this.candidateId) {
          this.startAIStatusPolling();
        }
      }, 
      error: e => {
        console.error(e);
        this.isSubmitting = false;
      }
    });
  }

  // NEW: Poll AI processing status
  startAIStatusPolling() {
    if (!this.candidateId) return;
    
    // Poll every 2 seconds until processing is complete
    interval(2000).pipe(
      takeWhile(() => !this.aiStatus || ['pending', 'processing'].includes(this.aiStatus.aiStatus))
    ).subscribe(() => {
      this.jobService.getCandidateAIStatus(this.candidateId!).subscribe({
        next: result => {
          this.aiStatus = result.data;
          console.log('AI Status:', this.aiStatus);
        },
        error: err => console.error('Failed to get AI status:', err)
      });
    });
  }

  apply() {
    const applicant = { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' };
    this.uploadAndApply(applicant);
  }
}
```

Plain fetch example (vanilla JS)
--------------------------------
Upload publicly, then call apply endpoint, with AI status tracking.

```js
async function uploadPublic(file) {
  const form = new FormData();
  form.append('file', file);
  const resp = await fetch('/api/files/upload/public', { method: 'POST', body: form });
  const json = await resp.json();
  // ApiResponse wrapper may be used on backend: json.data contains the record
  return json.data?.fileKey || json.fileKey || json.file?.fileKey;
}

async function apply(jobId, applicant, fileKey) {
  if (!jobId || !/^[0-9a-fA-F]{24}$/.test(jobId)) throw new Error('Invalid jobId');
  const payload = { ...applicant, resumeFileKey: fileKey };
  const res = await fetch(`/api/hiring/postings/${jobId}/apply`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  return res.json();
}

// NEW: Check AI processing status
async function getAIStatus(candidateId) {
  if (!candidateId || !/^[0-9a-fA-F]{24}$/.test(candidateId)) throw new Error('Invalid candidateId');
  const res = await fetch(`/api/ai-workflow/candidates/${candidateId}/status`);
  return res.json();
}

// NEW: Poll AI status until complete
async function pollAIStatus(candidateId, onUpdate) {
  let status;
  do {
    const result = await getAIStatus(candidateId);
    status = result.data;
    onUpdate(status);
    
    if (['pending', 'processing'].includes(status.aiStatus)) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    }
  } while (['pending', 'processing'].includes(status.aiStatus));
  
  return status;
}

// Usage:
async function applyWithStatusTracking(jobId, applicant, file) {
  try {
    const fileKey = await uploadPublic(file);
    const result = await apply(jobId, applicant, fileKey);
    const candidateId = result.data._id;
    
    console.log('Application submitted, tracking AI status...');
    
    const finalStatus = await pollAIStatus(candidateId, (status) => {
      console.log(`AI Status: ${status.aiStatus}`);
      if (status.aiRetryCount > 0) {
        console.log(`Retry attempts: ${status.aiRetryCount}`);
      }
    });
    
    if (finalStatus.aiStatus === 'complete') {
      console.log('AI analysis complete!');
      console.log('Extracted skills:', finalStatus.extractedSkills);
      console.log('Seniority level:', finalStatus.seniorityLevel);
    } else if (finalStatus.aiStatus === 'failed') {
      console.warn('AI analysis failed:', finalStatus.lastAIError?.message);
    }
    
    return { application: result, aiStatus: finalStatus };
  } catch (error) {
    console.error('Application failed:', error);
    throw error;
  }
}

// Example usage:
// const result = await applyWithStatusTracking(jobId, 
//   { firstName: 'John', lastName: 'Doe', email: 'john@example.com' }, 
//   fileInput.files[0]
// );
```

Apply-with-files (single-step)
------------------------------
If you'd rather let backend handle file upload + candidate creation in one request, use the `apply-with-files` endpoint.

```js
async function applyWithFiles(jobId, applicant, file) {
  const form = new FormData();
  form.append('resume', file);
  Object.keys(applicant).forEach(k => form.append(k, applicant[k]));
  const res = await fetch(`/api/hiring/postings/${jobId}/apply-with-files`, { method: 'POST', body: form });
  return res.json();
}
```

## AI Workflow Monitoring & Administration (NEW)

### For Candidates: Application Status Tracking

Candidates can track the progress of their AI analysis through status polling:

```js
// Real-time status display
function displayAIStatus(status) {
  const statusElement = document.getElementById('ai-status');
  
  switch (status.aiStatus) {
    case 'pending':
      statusElement.innerHTML = '⏳ Your application is queued for AI analysis...';
      break;
    case 'processing':
      statusElement.innerHTML = '🤖 AI is analyzing your resume...';
      break;
    case 'complete':
      statusElement.innerHTML = `✅ Analysis complete! Skills found: ${status.extractedSkills.join(', ')}`;
      break;
    case 'failed':
      statusElement.innerHTML = `❌ Analysis failed: ${status.lastAIError?.message}`;
      if (status.lastAIError?.retryable) {
        statusElement.innerHTML += ' (Will retry automatically)';
      }
      break;
    case 'skipped':
      statusElement.innerHTML = '⏭️ AI analysis skipped (no resume provided)';
      break;
  }
}
```

### For Administrators: Workflow Management

Admin interfaces can monitor and manage the AI workflow system:

```js
// Get overall AI workflow statistics
async function getWorkflowStats() {
  const res = await fetch('/api/ai-workflow/stats');
  return res.json();
}

// Display workflow dashboard
async function displayWorkflowDashboard() {
  const stats = await getWorkflowStats();
  const data = stats.data;
  
  console.log('AI Workflow Statistics:');
  console.log(`Pending: ${data.statusCounts.pending}`);
  console.log(`Processing: ${data.statusCounts.processing}`);
  console.log(`Complete: ${data.statusCounts.complete}`);
  console.log(`Failed: ${data.statusCounts.failed}`);
  console.log(`Skipped: ${data.statusCounts.skipped}`);
  
  // Show retry statistics
  Object.entries(data.retryCounts).forEach(([retryLevel, count]) => {
    console.log(`${retryLevel}: ${count}`);
  });
}

// Retry failed AI workflows
async function retryFailedWorkflows(limit = 10) {
  const res = await fetch('/api/ai-workflow/retry-failed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit })
  });
  return res.json();
}

// Manual queue candidate for AI processing
async function queueCandidateAI(candidateId, delay = 0) {
  const res = await fetch(`/api/ai-workflow/candidates/${candidateId}/queue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ delay, force: true })
  });
  return res.json();
}
```

Client validation rules (recommendations)
----------------------------------------
- firstName, lastName: required, 2–100 chars
- email: required, standard email regex
- resume: required (either pre-uploaded `resumeFileKey` or a file in `apply-with-files`), allowed types [.pdf, .doc, .docx, .txt], max 10MB
- coverLetter: optional, max 2000 chars

UI patterns & UX
----------------
- Landing shows searchable, paginated job list with `Apply` buttons.
- Clicking a job opens detail panel; `Apply` opens modal.
- Disable submission while file is uploading; show progress.
- On success, show confirmation and send a receipt email (backend attempts this).

Robustness & defensive coding
-----------------------------
- Never build URLs with unchecked variables. Example guard:

```ts
function safeJobUrl(jobId: string) {
  if (!jobId || !/^[0-9a-fA-F]{24}$/.test(jobId)) throw new Error('Invalid job id');
  return `/api/hiring/postings/${jobId}`;
}
```

- Frontend should never call apply with `undefined` or empty id; add console warnings and user-friendly error modals.

Error handling & monitoring
---------------------------
- Treat 400 responses as user errors and display messages from server.
- Handle 401 by prompting users to re-authenticate if endpoint requires token (candidate flow should be public).
- For 5xx, show a retry option and log to Sentry/your monitoring.

Testing suggestions
-------------------
- Unit tests: `JobService` using `HttpClientTestingModule`, including new AI workflow methods.
- Component tests: `ApplyModalComponent` to simulate file selection + apply + AI status tracking.
- Integration tests: Mock AI service responses for different status scenarios.
- E2E: simulate full flow using Cypress: list -> details -> upload -> apply -> track AI status
- **NEW**: Test AI workflow edge cases:
  - Application without resume (should show 'skipped' status)
  - AI processing failures and retry logic
  - Status polling during long-running analysis
  - Admin workflow management interfaces

## Error Handling Updates

### AI-Specific Error Scenarios
- **AI Processing Timeout**: Show user that analysis is taking longer than expected
- **AI Service Unavailable**: Display retry information and estimated wait times
- **Resume Parse Failure**: Inform user about file format issues
- **Network Issues**: Automatic retry with exponential backoff

```js
// Enhanced error handling for AI workflow
function handleAIError(status) {
  if (status.aiStatus === 'failed' && status.lastAIError) {
    const error = status.lastAIError;
    
    if (error.retryable) {
      return `Analysis failed but will retry automatically: ${error.message}`;
    } else {
      return `Analysis failed permanently: ${error.message}. Please contact support.`;
    }
  }
  return 'Unknown AI processing error';
}
```

Deliverables checklist (candidate side)
- [x] Job listing (search + pagination) contract
- [x] Job details contract
- [x] Public resume upload example + API endpoint documented
- [x] Apply flow (two options): pre-upload resume then apply, or single-step apply-with-files
- [x] Angular + fetch examples ready to copy-paste
- [x] **NEW**: AI workflow status tracking and monitoring
- [x] **NEW**: Real-time AI processing status updates
- [x] **NEW**: Admin workflow management interfaces
- [x] **NEW**: Enhanced error handling for AI failures
- [x] **NEW**: Retry logic documentation and examples

Next steps I can implement for you
- Generate the Angular `file.service.ts` + `job.service.ts` files in `src/app/services/` with full AI workflow support.
- Create skeleton components (`job-list`, `job-detail`, `apply-modal`, `ai-status-tracker`) and wire services.
- Add a small `docs/example-job-page.html` with vanilla JS for quick manual testing including AI status tracking.
- **NEW**: Create an admin dashboard component for AI workflow monitoring and management.
- **NEW**: Implement real-time WebSocket updates for AI processing status (advanced).
- **NEW**: Add React/Vue.js examples alongside Angular examples.
- **NEW**: Create a candidate portal showing application history with AI analysis results.

## Advanced Features Available

### Real-Time Updates (WebSocket Support)
The backend AI workflow system emits events that can be extended to support WebSocket connections for real-time status updates:

```js
// Example WebSocket integration (requires backend WebSocket setup)
const socket = io('/ai-workflow');

socket.on('candidate:ai:complete', (data) => {
  if (data.candidateId === currentCandidateId) {
    updateAIStatus(data.result);
  }
});

socket.on('candidate:ai:failed', (data) => {
  if (data.candidateId === currentCandidateId) {
    showAIError(data.error);
  }
});
```

### Bulk Operations
For administrative interfaces, bulk operations are supported:

```js
// Bulk retry failed candidates
async function bulkRetryFailed(candidateIds) {
  const res = await fetch('/api/ai-workflow/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      operation: 'retry',
      candidateIds: candidateIds,
      options: { delay: 1000 }
    })
  });
  return res.json();
}
```

### Performance Considerations
- **Status Polling**: Use reasonable intervals (2-5 seconds) to avoid overwhelming the server
- **Caching**: Cache AI status responses for brief periods to reduce API calls
- **Progressive Enhancement**: Show basic application confirmation immediately, enhance with AI status asynchronously
- **Graceful Degradation**: Ensure core application flow works even if AI status tracking fails

Pick one and I'll implement it in the repo.
