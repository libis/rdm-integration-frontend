/* istanbul ignore file */
// Author: Eryk Kulikowski @ KU Leuven (2026). Apache 2.0 License

import { Observable } from 'rxjs';

/**
 * Answers with the value on a timer, after the request as HTTP does, and
 * completes; under jasmine.clock() a tick answers it.
 */
export function answerLater<T>(value: T): Observable<T> {
  return new Observable<T>((observer) => {
    const id = setTimeout(() => {
      observer.next(value);
      observer.complete();
    });
    return () => clearTimeout(id);
  });
}
