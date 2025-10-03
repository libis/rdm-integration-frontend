import {
  ConnectValidationService,
  ConnectValidationContext,
} from './connect-validation.service';

describe('ConnectValidationService', () => {
  let service: ConnectValidationService;

  const baseCtx: ConnectValidationContext = {
    pluginId: 'github',
    datasetId: 'doi:10.123/ABC',
    sourceUrl: 'https://host/user/repo',
    token: 't',
    option: 'main',
    user: 'user',
    repoName: 'user/repo',
    getSourceUrlFieldName: () => 'Source URL',
    getTokenFieldName: () => 'Token',
    getOptionFieldName: () => 'Branch',
    getUsernameFieldName: () => 'Username',
    getRepoNameFieldName: () => 'Repository',
    parseUrl: () => undefined,
  };

  beforeEach(() => {
    service = new ConnectValidationService();
  });

  it('returns no issues for valid context', () => {
    const issues = service.gatherIssues(baseCtx);
    expect(issues.length).toBe(0);
    expect(service.isValid(baseCtx)).toBeTrue();
  });

  it('captures missing mandatory fields', () => {
    const ctx: ConnectValidationContext = {
      ...baseCtx,
      pluginId: undefined,
      datasetId: undefined,
    };
    const issues = service.gatherIssues(ctx);
    expect(issues).toContain('Repository type');
    expect(issues).toContain('Dataset DOI');
    expect(service.isValid(ctx)).toBeFalse();
    const summary = service.summarizeIssues(issues)!;
    expect(summary).toContain('One or more mandatory fields');
  });

  it('includes URL parse error when parseUrl returns message', () => {
    const ctx: ConnectValidationContext = {
      ...baseCtx,
      parseUrl: () => 'Malformed source url',
    };
    const issues = service.gatherIssues(ctx);
    expect(issues).toContain('Malformed source url');
  });
});
