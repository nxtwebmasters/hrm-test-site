import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  type: ToastType;
  text: string;
  id?: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private subject = new Subject<ToastMessage>();
  private counter = 1;

  get messages(): Observable<ToastMessage> {
    return this.subject.asObservable();
  }

  show(text: string, type: ToastType = 'info') {
    this.subject.next({ id: this.counter++, text, type });
  }

  success(text: string) {
    this.show(text, 'success');
  }

  error(text: string) {
    this.show(text, 'error');
  }
}
