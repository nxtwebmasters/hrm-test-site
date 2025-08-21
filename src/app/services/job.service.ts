import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
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

  // AI Workflow Methods
  getCandidateAIStatus(candidateId: string): Observable<any> {
    return this.http.get(`${this.aiBase}/candidates/${candidateId}/status`);
  }

  getAIWorkflowStats(): Observable<any> {
    return this.http.get(`${this.aiBase}/stats`);
  }

  retryFailedAIWorkflows(limit: number = 10): Observable<any> {
    return this.http.post(`${this.aiBase}/retry-failed`, { limit });
  }

  queueCandidateAI(candidateId: string, delay: number = 0): Observable<any> {
    return this.http.post(`${this.aiBase}/candidates/${candidateId}/queue`, { delay, force: true });
  }
}
