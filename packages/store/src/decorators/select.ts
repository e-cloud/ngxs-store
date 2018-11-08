import { Injectable } from '@angular/core';

import { Store } from '../store';
import { fastPropGetter, StateClassStatic } from '../internal/internals';
import { META_KEY, Type, ISelector } from '../symbols';
import { Observable } from 'rxjs';

/**
 * Allows the select decorator to get access to the DI store.
 * @ignore
 */
@Injectable()
export class SelectFactory<T> {
  static store: Store<any> | undefined = undefined;
  constructor(store: Store<T>) {
    SelectFactory.store = store;
  }
}

/**
 * Decorator for selecting a slice of state from the store.
 */
export function Select<T = any>(
  selectorOrFeature: string | ((state: any) => any) | StateClassStatic<T>,
  ...paths: string[]
) {
  return function(target: any, propertyKey: string) {
    const selectorFnName = '__' + propertyKey + '__selector';

    if (!selectorOrFeature) {
      // if foo$ => make it just foo
      selectorOrFeature =
        propertyKey.lastIndexOf('$') === propertyKey.length - 1
          ? propertyKey.substring(0, propertyKey.length - 1)
          : propertyKey;
    }

    const createSelect = (fn: ISelector<any, any>) => {
      const store = SelectFactory.store;

      if (!store) {
        throw new Error('SelectFactory not connected to store!');
      }

      return store.select(fn);
    };

    const createSelector = () => {
      if (typeof selectorOrFeature === 'string') {
        const propsArray = paths.length ? [selectorOrFeature, ...paths] : selectorOrFeature.split('.');

        return fastPropGetter(propsArray);
      } else if (
        (<StateClassStatic>selectorOrFeature)[META_KEY] &&
        (<StateClassStatic>selectorOrFeature)[META_KEY]!.path
      ) {
        return fastPropGetter((<StateClassStatic>selectorOrFeature)[META_KEY]!.path!.split('.'));
      } else {
        return selectorOrFeature;
      }
    };

    if (target[selectorFnName]) {
      throw new Error('You cannot use @Select decorator and a ' + selectorFnName + ' property.');
    }

    if (delete target[propertyKey]) {
      Object.defineProperty(target, selectorFnName, {
        writable: true,
        enumerable: false,
        configurable: true
      });

      Object.defineProperty(target, propertyKey, {
        get: function() {
          return this[selectorFnName] || (this[selectorFnName] = createSelect.apply(this, [createSelector()]));
        },
        enumerable: true,
        configurable: true
      });
    }
  };
}
