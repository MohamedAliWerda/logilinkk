import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-reset-password2',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './reset-password.component2.html',
  styleUrls: ['./reset-password.component2.css']
})
export class ResetPasswordComponent2 {
  resetForm: FormGroup;
  hidePassword = true;
  hideConfirm = true;

  constructor(private fb: FormBuilder, private router: Router) {
    this.resetForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirm: ['', Validators.required]
    });
  }

  onSubmit() {
    this.router.navigate(['/entreprise/loginen']);
  }
}