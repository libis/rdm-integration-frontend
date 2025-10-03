// Author: Architectural extraction (2025). Apache 2.0 License
// Encapsulates validation logic for ConnectComponent to reduce component size.

import { Injectable } from '@angular/core';

export interface ConnectValidationContext {
  pluginId?: string;
  datasetId?: string;
  sourceUrl?: string;
  token?: string;
  option?: string;
  user?: string;
  repoName?: string; // derived repo name from user selections
  getSourceUrlFieldName(): string | undefined;
  getTokenFieldName(): string | undefined;
  getOptionFieldName(): string | undefined;
  getUsernameFieldName(): string | undefined;
  getRepoNameFieldName(): string | undefined;
  parseUrl(): string | undefined; // side-effectful parse used previously
}

@Injectable({ providedIn: 'root' })
export class ConnectValidationService {
  gatherIssues(ctx: ConnectValidationContext): string[] {
    const issues: string[] = [];
    const required: { value: string | undefined; name: string }[] = [
      { value: ctx.pluginId, name: 'Repository type' },
      { value: ctx.datasetId, name: 'Dataset DOI' },
    ];
    if (ctx.getSourceUrlFieldName())
      required.push({
        value: ctx.sourceUrl,
        name: ctx.getSourceUrlFieldName()!,
      });
    if (ctx.getTokenFieldName())
      required.push({ value: ctx.token, name: ctx.getTokenFieldName()! });
    if (ctx.getOptionFieldName())
      required.push({ value: ctx.option, name: ctx.getOptionFieldName()! });
    if (ctx.getUsernameFieldName())
      required.push({ value: ctx.user, name: ctx.getUsernameFieldName()! });
    if (ctx.getRepoNameFieldName())
      required.push({ value: ctx.repoName, name: ctx.getRepoNameFieldName()! });
    for (const r of required) {
      if (!r.value || r.value === 'loading') issues.push(r.name);
    }
    const urlErr = ctx.parseUrl();
    if (urlErr) issues.push(urlErr);
    return issues;
  }

  summarizeIssues(issues: string[]): string | undefined {
    if (issues.length === 0) return undefined;
    let res = 'One or more mandatory fields are missing:';
    for (const i of issues) {
      if (
        i.startsWith('Malformed') ||
        i.startsWith('Source URL') ||
        i.includes('invalid') ||
        i.includes('://')
      ) {
        res += `\n\n${i}`;
      } else {
        res += `\n- ${i}`;
      }
    }
    return res;
  }

  isValid(ctx: ConnectValidationContext): boolean {
    return this.gatherIssues(ctx).length === 0;
  }
}
