import { OperatorFunction, Observable, MonoTypeOperatorFunction } from 'rxjs';
import { map, filter } from 'rxjs/operators';
import { getActionTypeFromInstanceOrClass, getActionTypeFromClass } from '../utils/utils';
import { ActionContext, ActionStatus } from '../actions-stream';
import { ActionType, IAction } from '../symbols';

export function ofAction<T>(allowedType: ActionType<T>): OperatorFunction<any, T>;
export function ofAction<T>(...allowedTypes: ActionType<T>[]): OperatorFunction<any, T>;

/**
 * RxJS operator for selecting out specific actions.
 *
 * This will grab actions that have just been dispatched as well as actions that have completed
 */
export function ofAction<T>(...allowedTypes: ActionType<T>[]) {
  return ofActionOperator(allowedTypes);
}

/**
 * RxJS operator for selecting out specific actions.
 *
 * This will ONLY grab actions that have just been dispatched
 */
export function ofActionDispatched<T>(...allowedTypes: ActionType<T>[]) {
  return ofActionOperator(allowedTypes, ActionStatus.Dispatched);
}

/**
 * RxJS operator for selecting out specific actions.
 *
 * This will ONLY grab actions that have just been successfully completed
 */
export function ofActionSuccessful<T>(...allowedTypes: ActionType<T>[]) {
  return ofActionOperator(allowedTypes, ActionStatus.Successful);
}

/**
 * RxJS operator for selecting out specific actions.
 *
 * This will ONLY grab actions that have just been canceled
 */
export function ofActionCanceled<T>(...allowedTypes: ActionType<T>[]) {
  return ofActionOperator(allowedTypes, ActionStatus.Canceled);
}

/**
 * RxJS operator for selecting out specific actions.
 *
 * This will ONLY grab actions that have just thrown an error
 */
export function ofActionErrored<T>(...allowedTypes: ActionType<T>[]) {
  return ofActionOperator(allowedTypes, ActionStatus.Errored);
}

function ofActionOperator<T>(allowedTypes: ActionType<T>[], status?: ActionStatus) {
  const allowedMap = createAllowedMap(allowedTypes);
  return function(actions: Observable<ActionContext<T>>) {
    return actions.pipe(
      filterStatus(allowedMap, status),
      mapAction<T>()
    );
  };
}

function filterStatus(allowedTypes: Record<string, boolean>, status?: ActionStatus) {
  return filter((ctx: ActionContext<IAction>) => {
    const actionType = getActionTypeFromInstanceOrClass(ctx.action!)!;
    const type = allowedTypes[actionType];
    return status ? type && ctx.status === status : type;
  }) as MonoTypeOperatorFunction<any>;
}

function mapAction<T>() {
  return map((ctx: ActionContext<T>) => ctx.action!);
}

function createAllowedMap<T>(types: ActionType<T>[]) {
  return types.reduce(
    (acc, klass) => {
      acc[getActionTypeFromInstanceOrClass(klass)!] = true;
      return acc;
    },
    <Record<string, boolean>>{}
  );
}
