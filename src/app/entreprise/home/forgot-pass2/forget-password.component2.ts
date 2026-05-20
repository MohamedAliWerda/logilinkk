import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-forget-password2',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './forget-password.component2.html',
  styleUrls: ['./forget-password.component2.css']
})
export class ForgetPasswordComponent2 {
  emailForm: FormGroup;

  constructor(private fb: FormBuilder, private router: Router) {
    this.emailForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  onSubmit() {
    this.router.navigate(['/entreprise/verify-code'], {
      state: { email: this.emailForm.value.email }
    });
  }
}