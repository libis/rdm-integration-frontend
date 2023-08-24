import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})

export class UtilsService {

  constructor() { /*NOOP*/ }

  sleep(ms: number): Promise<void> {
    return new Promise<void>(() => setTimeout(() => { /*NOOP*/ }, ms));
  }

}
