import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-verify',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './verify.html',
  styleUrls: ['./verify.css']
})
export class Verify {
   digits: string[] = ['', '', '', '', '', ''];
  email: string = '';
  errorMsg: string = '';
  resendCooldown: number = 0;
  private timerInterval: number | undefined;

  constructor(private readonly router: Router) {}

  ngOnInit(): void {
    const state = history.state;
    this.email = state?.email || 'votre email';
    this.startCooldown();
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  onInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const val = input.value.replace(/\D/g, '').slice(-1);
    this.digits[index] = val;
    input.value = val;
    this.errorMsg = '';
    
    if (val && index < 5) {
      const next = document.querySelectorAll<HTMLInputElement>('.digit-input')[index + 1];
      next?.focus();
    }
  }

  onKeydown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Backspace' && !this.digits[index] && index > 0) {
      const prev = document.querySelectorAll<HTMLInputElement>('.digit-input')[index - 1];
      prev?.focus();
    }
  }

  onPaste(event: ClipboardEvent): void {
    const text = event.clipboardData?.getData('text').replace(/\D/g, '').slice(0, 6) || '';
    text.split('').forEach((ch, i) => { this.digits[i] = ch; });
    
    const inputs = document.querySelectorAll<HTMLInputElement>('.digit-input');
    inputs.forEach((inp, i) => inp.value = this.digits[i] || '');
    inputs[Math.min(text.length, 5)]?.focus();
    this.errorMsg = '';
    event.preventDefault();
  }

  verify(): void {
    const code = this.digits.join('');
    if (code.length < 6) {
      this.errorMsg = 'Veuillez entrer le code complet à 6 chiffres.';
      return;
    }
    this.router.navigate(['/dashboard']);
  }

  resend(): void {
    if (this.resendCooldown > 0) return;
    
    // TODO: call backend to resend code
    console.log('Resend verification code to:', this.email);
    this.startCooldown();
  }

  private startCooldown(): void {
    this.resendCooldown = 60;
    this.clearTimer();
    this.timerInterval = window.setInterval(() => {
      this.resendCooldown--;
      if (this.resendCooldown <= 0) {
        this.clearTimer();
      }
    }, 1000);
  }

  private clearTimer(): void {
    if (this.timerInterval !== undefined) {
      clearInterval(this.timerInterval);
      this.timerInterval = undefined;
    }
  }

}
