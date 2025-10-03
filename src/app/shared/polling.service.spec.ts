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
});
