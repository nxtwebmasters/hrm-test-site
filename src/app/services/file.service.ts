import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class FileService {
  private base = '/api';
  constructor(private http: HttpClient) {}

  // Accept either a File or a pre-built FormData so callers can add extra fields (category, tags)
  uploadPublicFile(payload: File | FormData, category: string = 'resume'): Observable<HttpEvent<any>> {
    const url = `${this.base}/files/upload/public`;
    let form: FormData;
    if (payload instanceof FormData) {
      form = payload;
    } else {
      form = new FormData();
      form.append('file', payload, payload.name);
      form.append('category', category);
    }
    const req = new HttpRequest('POST', url, form, { reportProgress: true });
    return this.http.request(req);
  }
}
