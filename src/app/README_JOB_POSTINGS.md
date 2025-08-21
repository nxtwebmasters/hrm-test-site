Quick starter for Job Postings frontend

Files added:
- `src/app/models/job.ts` — JobPosting and ApplyRequest interfaces.
- `src/app/services/job.service.ts` — minimal HttpClient service (list/get/apply/uploadResume).
- `src/app/components/job-list/*` — job list component (TS + HTML).
- `src/app/components/job-detail/*` — job detail component (TS + HTML).
- `src/app/components/apply-modal/*` — apply modal component (TS + HTML).

How to wire into an Angular app

1. Ensure `HttpClientModule` and `ReactiveFormsModule` (and `FormsModule` if you still use template forms) are imported in your `AppModule`.
2. The services to use are `JobService` and `FileService` (public upload). Both are provided in root.
3. Use `<app-job-list (selectedJob)="onSelect($event)"></app-job-list>` and render `<app-job-detail [job]="selectedJob"></app-job-detail>`.
4. The apply dialog uses Reactive Forms and is opened by the parent when a valid job id exists.

Start dev server (with proxy to backend):

1. Ensure your backend runs at `http://localhost:5000` and CORS allows the frontend origin, or use the proxy provided.
2. Start the frontend with the proxy config (this forwards `/api` calls to your backend):

```powershell
npm install
npm start
```

Notes
- The services use proxy-friendly relative paths (`/api/hiring` and `/api/files/upload/public`). If you prefer not to use the proxy, update `JobService.base` and `FileService.base` to the backend absolute URL.
- The apply modal is accessible (ARIA role=dialog), traps focus and supports Escape to close. It uses Reactive Forms for validation.
- Add error handling and tests before production.
