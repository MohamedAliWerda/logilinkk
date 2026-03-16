import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-verify-code',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './verify-code.component.html',
  styleUrls: ['./verify-code.component.css']
})
export class VerifyCodeComponent {
  codeForm: FormGroup;

  constructor(private fb: FormBuilder, private router: Router) {
    this.codeForm = this.fb.group({
      code: ['', Validators.required]
    });
  }

  onSubmit() {
    // Here, verify code
    this.router.navigate(['/reset-password']);
  }
}
