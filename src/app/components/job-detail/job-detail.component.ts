import { Component, Input, Output, EventEmitter } from '@angular/core';
import { JobPosting } from '../../models/job';

@Component({
  selector: 'app-job-detail',
  templateUrl: './job-detail.component.html',
})
export class JobDetailComponent {
  @Input() job: JobPosting | null = null;
  @Output() openApply = new EventEmitter<void>();
  @Output() view = new EventEmitter<string>();

  apply() {
    this.openApply.emit();
  }

  viewDetails() {
  if (!this.job) return;
  const id = this.job._id || (this.job as any).id;
  if (id) this.view.emit(id);
  }
}
