import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class SidebarAdminService {
  private _isOpen = new BehaviorSubject<boolean>(true);
  private _activeItem = new BehaviorSubject<string>('dashboard');

  isOpen$ = this._isOpen.asObservable();
  activeItem$ = this._activeItem.asObservable();

  toggle(): void {
    this._isOpen.next(!this._isOpen.value);
  }

  open(): void {
    this._isOpen.next(true);
  }

  close(): void {
    this._isOpen.next(false);
  }

  setActiveItem(item: string): void {
    this._activeItem.next(item);
  }
}
