import { Component, EventEmitter, Output, Input, ElementRef, OnInit, ViewChild, AfterViewInit, HostListener, OnDestroy } from '@angular/core';
import { JobService } from '../../services/job.service';
import { FileService } from '../../services/file.service';
import { ToastService } from '../../services/toast.service';
import { ApplyRequest, CandidateAIStatus } from '../../models/job';
import { HttpEventType } from '@angular/common/http';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { interval, Subscription } from 'rxjs';
import { takeWhile } from 'rxjs/operators';

@Component({
  selector: 'app-apply-modal',
  templateUrl: './apply-modal.component.html',
})
export class ApplyModalComponent implements AfterViewInit, OnDestroy {
  @Output() applied = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();
  @Input() jobId?: string;
  form: FormGroup;
  file?: File;
  uploadProgress = 0;
  uploading = false;
  resumeFileKey?: string;
  submitting = false;
  
  // AI Status Tracking
  candidateId?: string;
  aiStatus?: CandidateAIStatus;
  statusPolling?: Subscription;
  showAIStatus = false;

  allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
  maxSize = 10 * 1024 * 1024; // 10MB

  @ViewChild('firstInput', { static: false }) firstInput?: ElementRef<HTMLInputElement>;

  constructor(private jobService: JobService, private fileService: FileService, private host: ElementRef, private toast: ToastService) {
    this.form = new FormGroup({
      firstName: new FormControl('', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]),
      lastName: new FormControl('', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]),
      email: new FormControl('', [Validators.required, Validators.email]),
      phone: new FormControl(''),
      coverLetter: new FormControl('', [Validators.maxLength(2000)]),
    });
  }

  ngAfterViewInit(): void {
    // set focus to first input when modal mounts
    setTimeout(() => this.firstInput?.nativeElement?.focus(), 0);
  }

  ngOnDestroy(): void {
    this.stopAIStatusPolling();
  }

  stopAIStatusPolling(): void {
    if (this.statusPolling) {
      this.statusPolling.unsubscribe();
      this.statusPolling = undefined;
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      this.close.emit();
    }
    // simple focus trap: if tab pressed, ensure focus stays inside modal
    if (event.key === 'Tab') {
      const modal = this.host.nativeElement.querySelector('.modal');
      if (!modal) return;
      const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      const first = focusable[0] as HTMLElement;
      const last = focusable[focusable.length - 1] as HTMLElement;
      if (event.shiftKey && document.activeElement === first) {
        last.focus();
        event.preventDefault();
      } else if (!event.shiftKey && document.activeElement === last) {
        first.focus();
        event.preventDefault();
      }
    }
  }

  onFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const f = input.files[0];
      if (!this.allowedTypes.includes(f.type)) {
        console.warn('Invalid file type');
        return;
      }
      if (f.size > this.maxSize) {
        console.warn('File too large');
        return;
      }
      this.file = f;
    }
  }
  uploadPublicFile(): Promise<string | undefined> {
    if (!this.file) return Promise.resolve(undefined);
    this.uploading = true;
    return new Promise((resolve, reject) => {
      this.fileService.uploadPublicFile(this.file!, 'resume').subscribe({
        next: (event) => {
          if (event.type === HttpEventType.UploadProgress) {
            if (event.total) this.uploadProgress = Math.round((100 * event.loaded) / event.total);
          } else if ((event as any).type === HttpEventType.Response) {
            this.uploading = false;
            const body = (event as any).body?.data || (event as any).body;
            const fileKey = body?.fileKey || body?.file?.fileKey || body?.data?.fileKey || body?.id;
            this.resumeFileKey = fileKey;
            resolve(fileKey);
          }
        },
        error: (err) => {
          this.uploading = false;
          reject(err);
        },
      });
    });
  }

  isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  isValidJobId(id?: string) {
    return !!id && /^[0-9a-fA-F]{24}$/.test(id);
  }

  async submit(jobId: string) {
    if (!this.isValidJobId(jobId)) {
      console.warn('Invalid job id, aborting apply');
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting = true;
    try {
      const key = await this.uploadPublicFile();
      const payload: ApplyRequest = {
        firstName: this.form.value.firstName,
        lastName: this.form.value.lastName,
        email: this.form.value.email,
        phone: this.form.value.phone || undefined,
        coverLetter: this.form.value.coverLetter || undefined,
        resumeFileKey: key,
      };
      
      const result = await this.jobService.applyToJob(jobId, payload).toPromise();
      this.candidateId = result?.data?._id;
      this.toast.success('Application submitted — thank you');
      
      // Start AI status tracking if we have a candidate ID
      if (this.candidateId) {
        this.showAIStatus = true;
        this.startAIStatusPolling();
      }
      
      this.applied.emit();
    } catch (e) {
      console.error(e);
      this.toast.error('Failed to submit application');
    } finally {
      this.submitting = false;
    }
  }

  startAIStatusPolling(): void {
    if (!this.candidateId) return;
    
    this.statusPolling = interval(2000).pipe(
      takeWhile(() => !this.aiStatus || ['pending', 'processing'].includes(this.aiStatus.aiStatus))
    ).subscribe(() => {
      this.jobService.getCandidateAIStatus(this.candidateId!).subscribe({
        next: (result) => {
          this.aiStatus = result?.data;
          console.log('AI Status:', this.aiStatus);
          
          if (this.aiStatus?.aiStatus === 'complete') {
            this.toast.success('AI analysis complete!');
          } else if (this.aiStatus?.aiStatus === 'failed') {
            const retryable = this.aiStatus.lastAIError?.retryable ? ' (will retry automatically)' : '';
            this.toast.error(`AI analysis failed${retryable}`);
          }
        },
        error: (err) => {
          console.error('Failed to get AI status:', err);
          this.stopAIStatusPolling();
        }
      });
    });
  }

  getAIStatusMessage(): string {
    if (!this.aiStatus) return 'Checking AI status...';
    
    switch (this.aiStatus.aiStatus) {
      case 'pending':
        return '⏳ Your application is queued for AI analysis...';
      case 'processing':
        return '🤖 AI is analyzing your resume...';
      case 'complete':
        return `✅ Analysis complete! Skills found: ${this.aiStatus.extractedSkills?.join(', ') || 'None identified'}`;
      case 'failed':
        const retryMsg = this.aiStatus.lastAIError?.retryable ? ' (Will retry automatically)' : '';
        return `❌ Analysis failed: ${this.aiStatus.lastAIError?.message}${retryMsg}`;
      case 'skipped':
        return '⏭️ AI analysis skipped (no resume provided)';
      default:
        return 'Unknown status';
    }
  }
}
