import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  loginForm: FormGroup;
  hidePassword = true;

  constructor(private fb: FormBuilder, private router: Router) {
    this.loginForm = this.fb.group({
      identifiant: ['', Validators.required],
      password: ['', Validators.required]
    });
  }

  onSubmit() {
    this.router.navigate(['/auth/verify'], {
      state: { email: this.loginForm.value.identifiant }
    });
  }
}
