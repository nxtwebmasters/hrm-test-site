import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { interval, Subscription } from 'rxjs';
import { takeWhile } from 'rxjs/operators';
import { JobService } from '../../services/job.service';
import { CandidateAIStatus } from '../../models/job';

@Component({
  selector: 'app-ai-status',
  templateUrl: './ai-status.component.html',
})
export class AIStatusComponent implements OnInit, OnDestroy {
  @Input() candidateId?: string;
  @Input() autoStart = true;
  @Input() pollInterval = 2000;
  
  aiStatus?: CandidateAIStatus;
  polling?: Subscription;
  
  constructor(private jobService: JobService) {}
  
  ngOnInit(): void {
    if (this.autoStart && this.candidateId) {
      this.startPolling();
    }
  }
  
  ngOnDestroy(): void {
    this.stopPolling();
  }
  
  startPolling(): void {
    if (!this.candidateId) return;
    
    this.polling = interval(this.pollInterval).pipe(
      takeWhile(() => !this.aiStatus || ['pending', 'processing'].includes(this.aiStatus.aiStatus))
    ).subscribe(() => {
      this.jobService.getCandidateAIStatus(this.candidateId!).subscribe({
        next: (result) => {
          this.aiStatus = result?.data;
          console.log('AI Status Update:', this.aiStatus);
        },
        error: (err) => {
          console.error('Failed to get AI status:', err);
          this.stopPolling();
        }
      });
    });
  }
  
  stopPolling(): void {
    if (this.polling) {
      this.polling.unsubscribe();
      this.polling = undefined;
    }
  }
  
  getStatusMessage(): string {
    if (!this.aiStatus) return 'Checking AI status...';
    
    switch (this.aiStatus.aiStatus) {
      case 'pending':
        return '⏳ Queued for AI analysis...';
      case 'processing':
        return '🤖 AI is analyzing your resume...';
      case 'complete':
        return `✅ Analysis complete! Skills: ${this.aiStatus.extractedSkills?.join(', ') || 'None identified'}`;
      case 'failed':
        const retryMsg = this.aiStatus.lastAIError?.retryable ? ' (Auto-retry pending)' : '';
        return `❌ Analysis failed: ${this.aiStatus.lastAIError?.message}${retryMsg}`;
      case 'skipped':
        return '⏭️ AI analysis skipped (no resume provided)';
      default:
        return 'Unknown status';
    }
  }
  
  getStatusClass(): string {
    if (!this.aiStatus) return 'status-loading';
    
    switch (this.aiStatus.aiStatus) {
      case 'pending':
      case 'processing':
        return 'status-processing';
      case 'complete':
        return 'status-complete';
      case 'failed':
        return 'status-failed';
      case 'skipped':
        return 'status-skipped';
      default:
        return 'status-unknown';
    }
  }
}
