import { Injectable, ErrorHandler, NgZone } from '@angular/core';
import { Observable, of, forkJoin, empty, Subject, throwError } from 'rxjs';
import { shareReplay, filter, exhaustMap, take } from 'rxjs/operators';

import { compose } from '../utils/compose';
import { InternalActions, ActionStatus, ActionContext } from '../actions-stream';
import { StateStream } from './state-stream';
import { PluginManager } from '../plugin-manager';
import { enterZone } from '../operators/zone';
import { IAction } from '../symbols';

/**
 * Internal Action result stream that is emitted when an action is completed.
 * This is used as a method of returning the action result to the dispatcher
 * for the observable returned by the dispatch(...) call.
 * The dispatcher then asynchronously pushes the result from this stream onto the main action stream as a result.
 */
@Injectable()
export class InternalDispatchedActionResults extends Subject<ActionContext<IAction>> {}

@Injectable()
export class InternalDispatcher<T> {
  constructor(
    private _errorHandler: ErrorHandler,
    private _actions: InternalActions<IAction>,
    private _actionResults: InternalDispatchedActionResults,
    private _pluginManager: PluginManager,
    private _stateStream: StateStream<T>,
    private _ngZone: NgZone
  ) {}

  /**
   * Dispatches event(s).
   */
  dispatch(actionOrActions: IAction | IAction[]): Observable<any> {
    const result: Observable<any> = this._ngZone.runOutsideAngular(() => {
      if (Array.isArray(actionOrActions)) {
        return forkJoin(actionOrActions.map(a => this.dispatchSingle(a)));
      } else {
        return this.dispatchSingle(actionOrActions);
      }
    });

    result.subscribe({
      error: error => this._ngZone.run(() => this._errorHandler.handleError(error))
    });

    return result.pipe(enterZone(this._ngZone));
  }

  private dispatchSingle(action: IAction): Observable<any> {
    const prevState = this._stateStream.getValue();
    const plugins = this._pluginManager.plugins;

    return (compose([
      ...plugins,
      (nextState: any, nextAction: IAction) => {
        if (nextState !== prevState) {
          this._stateStream.next(nextState);
        }
        const actionResult$ = this.getActionResultStream(nextAction);
        actionResult$.subscribe(ctx => this._actions.next(ctx));
        this._actions.next({ action: nextAction, status: ActionStatus.Dispatched });
        return this.createDispatchObservable(actionResult$);
      }
    ])(prevState, action) as Observable<any>).pipe(shareReplay());
  }

  private getActionResultStream(action: IAction): Observable<ActionContext<IAction>> {
    return this._actionResults.pipe(
      filter((ctx: ActionContext<IAction>) => ctx.action === action && ctx.status !== ActionStatus.Dispatched),
      take(1),
      shareReplay()
    );
  }

  private createDispatchObservable(actionResult$: Observable<ActionContext<IAction>>): Observable<any> {
    return actionResult$
      .pipe(
        exhaustMap((ctx: ActionContext<IAction>) => {
          switch (ctx.status) {
            case ActionStatus.Successful:
              return of(this._stateStream.getValue());
            case ActionStatus.Errored:
              return throwError(ctx.error);
            default:
              return empty();
          }
        })
      )
      .pipe(shareReplay());
  }
}
