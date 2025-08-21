import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { JobService } from '../../services/job.service';

@Component({
  selector: 'app-job-list',
  templateUrl: './job-list.component.html',
})
export class JobListComponent implements OnInit {
  jobs: any[] = [];
  loading = false;
  @Output() selectedJob = new EventEmitter<any>();
  @Output() apply = new EventEmitter<any>();

  constructor(private jobService: JobService) {}

  ngOnInit(): void {
    this.load();
  }

  load(query: any = { page: 1, pageSize: 10 }) {
    this.loading = true;
    this.jobService.listJobs(query).subscribe({
      next: (res) => {
        this.jobs = res?.data || res || [];
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  select(job: any) {
    this.selectedJob.emit(job);
  }

  applyNow(job: any) {
    this.apply.emit(job);
  }
}
