import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-verify-code2',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './verify-code.component2.html',
  styleUrls: ['./verify-code.component2.css']
})
export class VerifyCodeComponent2 {
  codeForm: FormGroup;

  constructor(private fb: FormBuilder, private router: Router) {
    this.codeForm = this.fb.group({
      code: ['', Validators.required]
    });
  }

  onSubmit() {
    this.router.navigate(['/entreprise/reset-password']);
  }
}