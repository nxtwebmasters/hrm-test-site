import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { AppComponent } from './app.component';
import { JobListComponent } from './components/job-list/job-list.component';
import { JobDetailComponent } from './components/job-detail/job-detail.component';
import { ApplyModalComponent } from './components/apply-modal/apply-modal.component';
import { ToastComponent } from './components/toast/toast.component';
import { AIStatusComponent } from './components/ai-status/ai-status.component';

@NgModule({
  declarations: [AppComponent, JobListComponent, JobDetailComponent, ApplyModalComponent, ToastComponent, AIStatusComponent],
  imports: [BrowserModule, FormsModule, ReactiveFormsModule, HttpClientModule],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
