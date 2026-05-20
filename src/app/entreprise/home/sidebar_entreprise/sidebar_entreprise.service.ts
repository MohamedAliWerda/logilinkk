import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class SidebarEntrepriseService {
  private _isOpen = new BehaviorSubject<boolean>(true);

  isOpen$ = this._isOpen.asObservable();

  toggle(): void {
    this._isOpen.next(!this._isOpen.value);
  }

  open(): void {
    this._isOpen.next(true);
  }

  close(): void {
    this._isOpen.next(false);
  }
}
