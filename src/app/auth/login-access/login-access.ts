import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-login-access',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './login-access.html',
  styleUrls: ['../login/login.css', './login-access.css']
})
export class LoginAccess {}
