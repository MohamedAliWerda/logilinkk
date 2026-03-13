import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-verify',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './verify.component.html',
  styleUrls: ['./verify.component.css']
})
export class VerifyComponent implements OnInit {
  digits: string[] = ['', '', '', '', '', ''];
  email: string = '';
  errorMsg: string = '';
  resendCooldown: number = 0;
  private timer: any;

  constructor(private router: Router) {}

  ngOnInit() {
    const state = history.state;
    this.email = state?.email || 'votre email';
    this.startCooldown();
  }

  onInput(event: Event, index: number) {
    const input = event.target as HTMLInputElement;
    const val = input.value.replace(/\D/g, '').slice(-1);
    this.digits[index] = val;
    input.value = val;
    if (val && index < 5) {
      const next = document.querySelectorAll<HTMLInputElement>('.digit-input')[index + 1];
      next?.focus();
    }
  }

  onKeydown(event: KeyboardEvent, index: number) {
    if (event.key === 'Backspace' && !this.digits[index] && index > 0) {
      const prev = document.querySelectorAll<HTMLInputElement>('.digit-input')[index - 1];
      prev?.focus();
    }
  }

  onPaste(event: ClipboardEvent) {
    const text = event.clipboardData?.getData('text').replace(/\D/g, '').slice(0, 6) || '';
    text.split('').forEach((ch, i) => { this.digits[i] = ch; });
    const inputs = document.querySelectorAll<HTMLInputElement>('.digit-input');
    inputs.forEach((inp, i) => inp.value = this.digits[i] || '');
    inputs[Math.min(text.length, 5)]?.focus();
    event.preventDefault();
  }

  verify() {
    const code = this.digits.join('');
    if (code.length < 6) {
      this.errorMsg = 'Veuillez entrer le code complet à 6 chiffres.';
      return;
    }
    this.router.navigate(['/dashboard']);
  }

  resend() {
    if (this.resendCooldown > 0) return;
    // TODO: call backend to resend code
    console.log('Resend code to', this.email);
    this.startCooldown();
  }

  private startCooldown() {
    this.resendCooldown = 60;
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.resendCooldown--;
      if (this.resendCooldown <= 0) clearInterval(this.timer);
    }, 1000);
  }
}
