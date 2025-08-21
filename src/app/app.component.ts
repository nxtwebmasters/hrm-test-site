import { Component } from '@angular/core';
import { JobService } from './services/job.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
})
export class AppComponent {
  selectedJob: any = null;
  showApply = false;

  constructor(private jobService: JobService) {}

  onSelect(jobOrId: any) {
    const jobId =
      typeof jobOrId === 'string'
        ? jobOrId
        : jobOrId?._id || jobOrId?.id;
    if (!jobId) return;
    this.selectedJob = null;
    this.jobService.getJob(jobId).subscribe({
      next: (res) => (this.selectedJob = res?.data || res),
      error: () => (this.selectedJob = null),
    });
  }

  isValidJobId(id?: string) {
    return !!id && /^[0-9a-fA-F]{24}$/.test(id);
  }

  openApply(jobOrId?: any) {
    // If caller passed a job or id, ensure selectedJob is set
    if (jobOrId) {
      const id = typeof jobOrId === 'string' ? jobOrId : jobOrId?._id || jobOrId?.id;
      if (!this.isValidJobId(id)) {
        console.warn('Cannot open apply modal: invalid or missing job id');
        return;
      }
      // if job object passed, set selectedJob to it; else fetch details
      if (typeof jobOrId === 'object') this.selectedJob = jobOrId;
      else {
        this.jobService.getJob(id).subscribe({
          next: (res) => {
            this.selectedJob = res?.data || res;
            this.showApply = true;
          },
          error: () => {
            this.selectedJob = null;
            this.showApply = false;
          },
        });
      }
      return;
    }

    const id = this.selectedJob?._id || this.selectedJob?.id;
    if (!this.isValidJobId(id)) {
      console.warn('Cannot open apply modal: invalid or missing job id');
      return;
    }
    this.showApply = true;
  }

  closeApply() {
    this.showApply = false;
  }

  onApplied() {
    this.showApply = false;
    // optionally refresh listings or show toast
  }
}
