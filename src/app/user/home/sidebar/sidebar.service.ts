import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SidebarService {
  // Open by default
  private _isOpen = new BehaviorSubject<boolean>(true);
  private _activeItem = new BehaviorSubject<string>('dashboard');

  isOpen$ = this._isOpen.asObservable();
  activeItem$ = this._activeItem.asObservable();

  toggle() {
    this._isOpen.next(!this._isOpen.value);
  }

  open() {
    this._isOpen.next(true);
  }

  close() {
    this._isOpen.next(false);
  }

  setActiveItem(item: string) {
    this._activeItem.next(item);
  }
}