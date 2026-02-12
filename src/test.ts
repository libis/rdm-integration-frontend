// This file is required by karma.conf.js and loads recursively all the .spec and framework files

import { NgModule, provideZonelessChangeDetection } from '@angular/core';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserTestingModule,
  platformBrowserTesting,
} from '@angular/platform-browser/testing';

// Provide zoneless change detection globally via a module passed to initTestEnvironment.
// This matches the production configuration (main.ts) and ensures all tests run
// without zone.js, catching signal-reactivity bugs that Zone.js would mask.
@NgModule({
  providers: [provideZonelessChangeDetection()],
})
class ZonelessTestingModule {}

getTestBed().initTestEnvironment(
  [BrowserTestingModule, ZonelessTestingModule],
  platformBrowserTesting(),
);
