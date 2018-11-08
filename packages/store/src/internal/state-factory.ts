import { Injector, Injectable, SkipSelf, Optional } from '@angular/core';
import { Observable, of, forkJoin, from, throwError } from 'rxjs';
import { shareReplay, takeUntil, map, catchError, filter, mergeMap, defaultIfEmpty } from 'rxjs/operators';

import { META_KEY, NgxsLifeCycle, NgxsConfig, IAction } from '../symbols';
import {
  topologicalSort,
  buildGraph,
  findFullParentPath,
  nameToState,
  compliantPropGetter,
  fastPropGetter,
  isObject,
  StateClass,
  MappedStore,
  StateClassStatic
} from './internals';
import { getActionTypeFromInstanceOrClass, setValue } from '../utils/utils';
import { ofActionDispatched } from '../operators/of-action';
import { InternalActions, ActionStatus, ActionContext } from '../actions-stream';
import { InternalDispatchedActionResults } from '../internal/dispatcher';
import { StateContextFactory } from '../internal/state-context-factory';

/**
 * State factory class
 * @ignore
 */
@Injectable()
export class StateFactory<T> {
  get states(): MappedStore[] {
    return this._parentFactory ? this._parentFactory.states : this._states;
  }

  private _states: MappedStore[] = [];
  private _connected = false;

  constructor(
    private _injector: Injector,
    private _config: NgxsConfig,
    @Optional()
    @SkipSelf()
    private _parentFactory: StateFactory<T>,
    private _actions: InternalActions<IAction>,
    private _actionResults: InternalDispatchedActionResults,
    private _stateContextFactory: StateContextFactory<T>
  ) {}

  /**
   * Add a new state to the global defs.
   */
  add(oneOrManyStateClasses: StateClassStatic | StateClassStatic[]): MappedStore[] {
    let stateClasses: StateClassStatic[];
    if (!Array.isArray(oneOrManyStateClasses)) {
      stateClasses = [oneOrManyStateClasses];
    } else {
      stateClasses = oneOrManyStateClasses;
    }

    const stateGraph = buildGraph(stateClasses);
    const sortedStates = topologicalSort(stateGraph);
    const depths = findFullParentPath(stateGraph);
    const nameGraph = nameToState(stateClasses);
    const mappedStores: MappedStore[] = [];

    for (const name of sortedStates) {
      const stateClass = nameGraph[name];

      if (!stateClass[META_KEY]) {
        throw new Error('States must be decorated with @State() decorator');
      }

      const depth = depths[name];
      const { actions } = stateClass[META_KEY]!;
      let { defaults } = stateClass[META_KEY]!;

      stateClass[META_KEY]!.path = depth;

      if (this._config && this._config.compatibility && this._config.compatibility.strictContentSecurityPolicy) {
        stateClass[META_KEY]!.selectFromAppState = compliantPropGetter(depth.split('.'));
      } else {
        stateClass[META_KEY]!.selectFromAppState = fastPropGetter(depth.split('.'));
      }

      // ensure our store hasn't already been added
      // but dont throw since it could be lazy
      // loaded from different paths
      const has = this.states.find(s => s.name === name);
      if (!has) {
        // create new instance of defaults
        if (Array.isArray(defaults)) {
          defaults = [...defaults];
        } else if (isObject(defaults)) {
          defaults = { ...defaults };
        } else if (defaults === undefined) {
          defaults = {};
        }

        const instance = this._injector.get(stateClass);

        mappedStores.push({
          actions,
          instance,
          defaults,
          name,
          depth
        });
      }
    }

    this.states.push(...mappedStores);

    return mappedStores;
  }

  /**
   * Add a set of states to the store and return the defaulsts
   */
  addAndReturnDefaults(stateClasses: any[]): { defaults: any; states: MappedStore[] } | undefined {
    if (stateClasses) {
      const states = this.add(stateClasses);
      const defaults = states.reduce(
        (result: any, meta: MappedStore) => setValue(result, meta.depth, meta.defaults),
        {}
      );
      return { defaults, states };
    }
  }

  /**
   * Bind the actions to the handlers
   */
  connectActionHandlers() {
    if (this._connected) return;
    this._actions
      .pipe(
        filter((ctx: ActionContext<IAction>) => ctx.status === ActionStatus.Dispatched),
        mergeMap(({ action }) =>
          this.invokeActions(this._actions, action!).pipe(
            map(() => <ActionContext<IAction>>{ action, status: ActionStatus.Successful }),
            defaultIfEmpty(<ActionContext<IAction>>{ action, status: ActionStatus.Canceled }),
            catchError(error => of(<ActionContext<IAction>>{ action, status: ActionStatus.Errored, error }))
          )
        )
      )
      .subscribe(ctx => this._actionResults.next(ctx));
    this._connected = true;
  }

  /**
   * Invoke the init function on the states.
   */
  invokeInit(stateMetadatas: MappedStore[]) {
    for (const metadata of stateMetadatas) {
      const instance: NgxsLifeCycle = metadata.instance;

      if (instance.ngxsOnInit) {
        const stateContext = this.createStateContext(metadata);
        instance.ngxsOnInit(stateContext);
      }
    }
  }

  /**
   * Invoke actions on the states.
   */
  invokeActions(actions$: InternalActions<IAction>, action: IAction) {
    const results = [];

    for (const metadata of this.states) {
      const type = getActionTypeFromInstanceOrClass(action)!;
      const actionMetas = metadata.actions[type];

      if (actionMetas) {
        for (const actionMeta of actionMetas) {
          const stateContext = this.createStateContext(metadata);
          try {
            let result = metadata.instance[actionMeta.fn](stateContext, action);

            if (result instanceof Promise) {
              result = from(result);
            }

            if (result instanceof Observable) {
              result = result.pipe(
                actionMeta.options.cancelUncompleted
                  ? // todo: ofActionDispatched should be used with action class
                    takeUntil(actions$.pipe(ofActionDispatched(action as any)))
                  : map(r => r)
              ); // map acts like a noop
            } else {
              result = of({}).pipe(shareReplay());
            }

            results.push(result);
          } catch (e) {
            results.push(throwError(e));
          }
        }
      }
    }

    if (!results.length) {
      results.push(of({}));
    }

    return forkJoin(results);
  }

  /**
   * Create the state context
   */
  private createStateContext(metadata: MappedStore) {
    return this._stateContextFactory.createStateContext(metadata);
  }
}
