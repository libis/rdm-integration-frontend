import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { NavigationService, WINDOW } from './navigation.service';

describe('NavigationService', () => {
  const setup = <T extends { location: { assign: jasmine.Spy } }>(options: {
    documentValue: Partial<Document>;
    windowValue: T;
  }) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: DOCUMENT, useValue: options.documentValue },
        { provide: WINDOW, useValue: options.windowValue },
      ],
    });
    return {
      service: TestBed.inject(NavigationService),
      windowValue: options.windowValue,
    };
  };

  it('delegates to provided defaultView when available', () => {
    const fakeWindow = { location: { assign: jasmine.createSpy('assign') } };
    const fallbackWindow = {
      location: { assign: jasmine.createSpy('fallback') },
    };
    const { service, windowValue } = setup({
      documentValue: { defaultView: fakeWindow } as unknown as Document,
      windowValue: fallbackWindow,
    });
    const targetUrl = 'https://example.com/path';
    service.assign(targetUrl);
    expect(fakeWindow.location.assign).toHaveBeenCalledWith(targetUrl);
    expect(fakeWindow.location.assign).toHaveBeenCalledTimes(1);
    expect(windowValue.location.assign).not.toHaveBeenCalled();
  });

  it('falls back to injected window when document has no defaultView', () => {
    const fallbackWindow = {
      location: {
        assign: jasmine.createSpy('assign'),
      },
    };
    const { service } = setup({
      documentValue: {} as unknown as Document,
      windowValue: fallbackWindow,
    });
    const targetUrl = 'https://example.org/alt';
    service.assign(targetUrl);
    expect(fallbackWindow.location.assign).toHaveBeenCalledWith(targetUrl);
  });
});
