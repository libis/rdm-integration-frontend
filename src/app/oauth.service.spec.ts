import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { TokenResponse } from './models/oauth';
import { OauthService } from './oauth.service';

describe('OauthService', () => {
  let service: OauthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(OauthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have correct token_url', () => {
    expect(service.token_url).toBe('api/common/oauthtoken');
  });

  it('should call getToken and return token response', () => {
    const mockResponse: TokenResponse = {
      session_id: 'test-session-123',
    };
    const pluginId = 'github';
    const code = 'auth-code-123';
    const nonce = 'nonce-456';

    service.getToken(pluginId, code, nonce).subscribe((response) => {
      expect(response).toEqual(mockResponse);
      expect(response.session_id).toBe('test-session-123');
    });

    const req = httpMock.expectOne('api/common/oauthtoken');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      pluginId: pluginId,
      code: code,
      nonce: nonce,
    });
    req.flush(mockResponse);
  });
});
