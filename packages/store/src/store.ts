// tslint:disable:unified-signatures
import { Injectable, NgZone } from '@angular/core';
import { Observable, of, Subscription } from 'rxjs';
import { catchError, distinctUntilChanged, map, take } from 'rxjs/operators';

import { getSelectorFn } from './utils/selector-utils';
import { InternalStateOperations } from './internal/state-operations';
import { StateStream } from './internal/state-stream';
import { enterZone } from './operators/zone';
import { StateClassStatic } from './internal/internals';

@Injectable()
export class Store<T> {
  constructor(
    private _ngZone: NgZone,
    private _stateStream: StateStream<T>,
    private _internalStateOperations: InternalStateOperations<T>
  ) {}

  /**
   * Dispatches event(s).
   */
  dispatch(event: any | any[]): Observable<any> {
    return this._internalStateOperations.getRootStateOperations().dispatch(event);
  }

  /**
   * Selects a slice of data from the store.
   */
  select<R, K>(selector: (state: T, ...subState: K[]) => R): Observable<R>;
  select<R, S>(selector: (...states: S[]) => R): Observable<R>;
  select<R, S>(memorizedSelector: (state: S) => R): Observable<R>;
  select<R>(selector: string | StateClassStatic): Observable<R>;
  select(selector: any): Observable<any> {
    const selectorFn = getSelectorFn(selector);
    return this._stateStream.pipe(
      map(selectorFn),
      catchError(err => {
        // if error is TypeError we swallow it to prevent usual errors with property access
        if (err instanceof TypeError) {
          return of(undefined);
        }

        // rethrow other errors
        throw err;
      }),
      distinctUntilChanged(),
      enterZone(this._ngZone)
    );
  }

  /**
   * Select one slice of data from the store.
   */
  selectOnce<R, K>(selector: (state: T, ...subState: K[]) => R): Observable<T>;
  selectOnce<R>(selector: string | StateClassStatic): Observable<R>;
  selectOnce<R, S>(selector: (...states: S[]) => R): Observable<R>;
  selectOnce<R, S>(memorizedSelector: (state: S) => R): Observable<R>;
  selectOnce(selector: any): Observable<any> {
    return this.select(selector).pipe(take(1));
  }

  /**
   * Select a snapshot from the state.
   */
  selectSnapshot<R, K>(selector: (state: T, ...subState: K[]) => R): R;
  selectSnapshot<R, S>(selector: (...states: S[]) => R): R;
  selectSnapshot<R, S>(memorizedSelector: (state: S) => R): R;
  selectSnapshot<R>(selector: string | StateClassStatic): R;
  selectSnapshot(selector: any): any {
    const selectorFn = getSelectorFn(selector);
    return selectorFn(this._stateStream.getValue());
  }

  /**
   * Allow the user to subscribe to the root of the state
   */
  subscribe(fn?: (value: Partial<T>) => void): Subscription {
    return this._stateStream.pipe(enterZone(this._ngZone)).subscribe(fn);
  }

  /**
   * Return the raw value of the state.
   */
  snapshot(): T {
    return this._internalStateOperations.getRootStateOperations().getState();
  }

  /**
   * Reset the state to a specific point in time. This method is useful
   * for plugin's who need to modify the state directly or unit testing.
   */
  reset(state: T) {
    return this._internalStateOperations.getRootStateOperations().setState(state);
  }
}
