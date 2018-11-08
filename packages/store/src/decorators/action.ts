// tslint:disable:max-line-length
import { ensureStoreMetadata } from '../internal/internals';
import { ActionOptions, ActionType, StateContext, IAction } from '../symbols';

export function Action<T = any>(actions: ActionType<T>, options?: ActionOptions): Function;

export function Action<T1>(actions: ActionType<T1>[], options?: ActionOptions): Function;
export function Action<T1, T2>(actions: [ActionType<T1>, ActionType<T2>], options?: ActionOptions): Function;
export function Action<T1, T2, T3>(
  actions: [ActionType<T1>, ActionType<T2>, ActionType<T3>],
  options?: ActionOptions
): Function;
export function Action<T1, T2, T3, T4>(
  actions: [ActionType<T1>, ActionType<T2>, ActionType<T3>, ActionType<T4>],
  options?: ActionOptions
): Function;
export function Action<T1, T2, T3, T4, T5>(
  actions: [ActionType<T1>, ActionType<T2>, ActionType<T3>, ActionType<T4>, ActionType<T5>],
  options?: ActionOptions
): Function;
export function Action<T1, T2, T3, T4, T5, T6>(
  actions: [ActionType<T1>, ActionType<T2>, ActionType<T3>, ActionType<T4>, ActionType<T5>, ActionType<T6>],
  options?: ActionOptions
): Function;
export function Action<T1, T2, T3, T4, T5, T6, T7>(
  actions: [
    ActionType<T1>,
    ActionType<T2>,
    ActionType<T3>,
    ActionType<T4>,
    ActionType<T5>,
    ActionType<T6>,
    ActionType<T7>
  ],
  options?: ActionOptions
): Function;
export function Action<T1, T2, T3, T4, T5, T6, T7, T8>(
  actions: [
    ActionType<T1>,
    ActionType<T2>,
    ActionType<T3>,
    ActionType<T4>,
    ActionType<T5>,
    ActionType<T6>,
    ActionType<T7>,
    ActionType<T8>
  ],
  options?: ActionOptions
): Function;
export function Action<T1, T2, T3, T4, T5, T6, T7, T8, T9>(
  actions: [
    ActionType<T1>,
    ActionType<T2>,
    ActionType<T3>,
    ActionType<T4>,
    ActionType<T5>,
    ActionType<T6>,
    ActionType<T7>,
    ActionType<T8>,
    ActionType<T9>
  ],
  options?: ActionOptions
): Function;

/*
 * Decorates a method with a action information.
 */
export function Action<T = any>(actions: ActionType<T> | ActionType<T>[], options?: ActionOptions) {
  return function(
    target: any,
    methodName: string | symbol,
    descriptor: TypedPropertyDescriptor<(ctx: StateContext<any>, action: IAction) => any>
  ) {
    const meta = ensureStoreMetadata(target.constructor);

    if (!Array.isArray(actions)) {
      actions = [actions];
    }

    for (const action of actions) {
      const type = action.type;

      if (!action.type) {
        throw new Error(`Action ${action.name} is missing a static "type" property`);
      }

      if (!meta.actions[type]) {
        meta.actions[type] = [];
      }

      meta.actions[type].push({
        fn: methodName,
        options: options || {},
        type
      });
    }
  };
}
