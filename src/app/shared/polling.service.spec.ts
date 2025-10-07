import { PollingService } from './polling.service';
import { of, throwError } from 'rxjs';

describe('PollingService', () => {
  let service: PollingService;
  beforeEach(() => {
    service = new PollingService();
  });

  it('polls until predicate stops', (done) => {
    let i = 0;
    const emissions: number[] = [];
    const handle = service.poll<number>({
      iterate: () => of(++i),
      onResult: (v) => emissions.push(v),
      shouldContinue: (v) => v < 3,
      delayMs: 1,
    });
    setTimeout(() => {
      expect(emissions).toEqual([1, 2, 3]);
      handle.cancel();
      done();
    }, 25);
  });

  it('stops on error when onError returns false', (done) => {
    let iter = 0;
    let errors = 0;
    const handle = service.poll<number>({
      iterate: () =>
        ++iter === 1 ? of(1) : throwError(() => new Error('fail')),
      onResult: () => {},
      shouldContinue: () => true,
      delayMs: 1,
      onError: () => {
        errors++;
        return false;
      },
    });
    setTimeout(() => {
      expect(iter).toBe(2);
      expect(errors).toBe(1);
      handle.cancel();
      done();
    }, 25);
  });

  it('continues after error when onError returns true', (done) => {
    let iter = 0;
    let errors = 0;
    const values: number[] = [];
    const handle = service.poll<number>({
      iterate: () => {
        iter++;
        if (iter % 2 === 0) {
          return throwError(() => new Error('flaky'));
        }
        return of(iter);
      },
      onResult: (v) => values.push(v),
      shouldContinue: (_v, i) => i < 3, // allow a few successful iterations
      delayMs: 1,
      onError: () => {
        errors++;
        return true; // keep polling
      },
    });
    setTimeout(() => {
      expect(values.length).toBeGreaterThan(0);
      expect(errors).toBeGreaterThan(0);
      handle.cancel();
      done();
    }, 40);
  });

  it('cancel prevents further scheduling and preserves current iteration count', (done) => {
    let iter = 0;
    const handle = service.poll<number>({
      iterate: () => of(++iter),
      onResult: () => {},
      shouldContinue: () => true,
      delayMs: 5,
    });
    setTimeout(() => {
      handle.cancel();
      const stoppedAt = handle.iteration;
      setTimeout(() => {
        // iteration should not increase after cancel
        expect(handle.iteration).toBe(stoppedAt);
        done();
      }, 20);
    }, 15);
  });

  it('swallows errors thrown inside onResult handler', (done) => {
    let i = 0;
    const handle = service.poll<number>({
      iterate: () => of(++i),
      onResult: () => {
        if (i === 1) throw new Error('handler boom');
      },
      shouldContinue: (_v, iteration) => iteration < 2,
      delayMs: 1,
    });
    setTimeout(() => {
      expect(handle.iteration).toBeGreaterThanOrEqual(2);
      handle.cancel();
      done();
    }, 25);
  });

  it('stops polling when shouldContinue throws', (done) => {
    let i = 0;
    const handle = service.poll<number>({
      iterate: () => of(++i),
      onResult: () => {},
      shouldContinue: () => {
        throw new Error('broken predicate');
      },
      delayMs: 1,
    });
    setTimeout(() => {
      expect(handle.iteration).toBe(1);
      handle.cancel();
      done();
    }, 25);
  });

  it('treats thrown onError as stop signal', (done) => {
    let iter = 0;
    const handle = service.poll<number>({
      iterate: () => {
        iter++;
        return throwError(() => new Error('fail-fast'));
      },
      onResult: () => {},
      shouldContinue: () => true,
      delayMs: 1,
      onError: () => {
        throw new Error('onError exploded');
      },
    });
    setTimeout(() => {
      expect(iter).toBeGreaterThan(0);
      expect(handle.iteration).toBe(0);
      handle.cancel();
      done();
    }, 25);
  });

  it('stops on error when no onError handler is provided', (done) => {
    let attempts = 0;
    const handle = service.poll<number>({
      iterate: () => {
        attempts++;
        return throwError(() => new Error('boom'));
      },
      onResult: () => {},
      shouldContinue: () => true,
      delayMs: 1,
    });
    setTimeout(() => {
      expect(attempts).toBe(1);
      expect(handle.iteration).toBe(0);
      handle.cancel();
      done();
    }, 25);
  });
});
