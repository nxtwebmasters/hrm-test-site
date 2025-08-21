import { Component, OnInit } from '@angular/core';
import { ToastService, ToastMessage } from '../../services/toast.service';

@Component({
  selector: 'app-toast',
  templateUrl: './toast.component.html',
})
export class ToastComponent implements OnInit {
  toasts: ToastMessage[] = [];

  constructor(private toastService: ToastService) {}

  ngOnInit(): void {
    this.toastService.messages.subscribe((t) => {
      this.toasts.push(t);
      // auto-dismiss after 4s
      setTimeout(() => this.dismiss(t.id), 4000);
    });
  }

  dismiss(id?: number) {
    if (!id) return;
    this.toasts = this.toasts.filter((t) => t.id !== id);
  }
}
