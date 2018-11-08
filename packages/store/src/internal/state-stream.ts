import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * BehaviorSubject of the entire state.
 * @ignore
 */
@Injectable()
export class StateStream<T> extends BehaviorSubject<Partial<T>> {
  constructor() {
    super({} as any);
  }
}
