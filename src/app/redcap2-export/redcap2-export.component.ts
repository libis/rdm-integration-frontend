import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { take } from 'rxjs';

import {
  Accordion,
  AccordionContent,
  AccordionHeader,
  AccordionPanel,
} from 'primeng/accordion';
import { ButtonDirective } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { Select } from 'primeng/select';
import { SelectItem } from 'primeng/api';

import { CredentialsService } from '../credentials.service';
import { DataStateService } from '../data.state.service';
import { RepoLookupService } from '../repo.lookup.service';
import { RepoLookupRequest } from '../models/repo-lookup';
import { NotificationService } from '../shared/notification.service';

type Redcap2Anonymization = 'none' | 'blank' | 'drop' | 'pseudonymize';

interface Redcap2VariableOption {
  name: string;
  anonymization: Redcap2Anonymization;
}

// Variables as shown in the anonymization table: the PHI-risk note is
// display-only and not sent back to the backend.
interface Redcap2VariableRow extends Redcap2VariableOption {
  note?: string;
}

// Minimum decoded length of the pseudonymization key; must match the backend
// (minPseudonymizationKeyBytes). The recommended key is 32 bytes.
const MIN_PSEUDONYMIZATION_KEY_BYTES = 16;

interface Redcap2PluginOptions {
  exportMode?: 'report' | 'records';
  reportId?: string;
  dataFormat: 'csv' | 'json';
  fields?: string[];
  forms?: string[];
  events?: string[];
  records?: string[];
  filterLogic?: string;
  dateRangeBegin?: string;
  dateRangeEnd?: string;
  recordType?: 'flat' | 'eav';
  csvDelimiter?: ',' | 'tab';
  rawOrLabel?: 'raw' | 'label';
  rawOrLabelHeaders?: 'raw' | 'label';
  exportSurveyFields?: boolean;
  exportDataAccessGroups?: boolean;
  variables?: Redcap2VariableOption[];
  pseudonymizationKey?: string;
  generatedAt?: string;
}

@Component({
  selector: 'app-redcap2-export',
  templateUrl: './redcap2-export.component.html',
  styleUrls: ['./redcap2-export.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    ButtonDirective,
    Select,
    Checkbox,
    Accordion,
    AccordionPanel,
    AccordionHeader,
    AccordionContent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Redcap2ExportComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly credentialsService = inject(CredentialsService);
  private readonly repoLookupService = inject(RepoLookupService);
  private readonly notificationService = inject(NotificationService);
  private readonly dataStateService = inject(DataStateService);

  readonly exportMode = signal<'report' | 'records'>('report');
  readonly reportId = signal<string>('');
  readonly dataFormat = signal<'csv' | 'json'>('csv');
  readonly recordType = signal<'flat' | 'eav'>('flat');
  readonly csvDelimiter = signal<',' | 'tab'>(',');
  readonly fieldsInput = signal('');
  readonly formsInput = signal('');
  readonly eventsInput = signal('');
  readonly recordsInput = signal('');
  readonly filterLogic = signal('');
  readonly dateRangeBegin = signal('');
  readonly dateRangeEnd = signal('');
  readonly rawOrLabel = signal<'raw' | 'label'>('raw');
  readonly rawOrLabelHeaders = signal<'raw' | 'label'>('raw');
  readonly exportSurveyFields = signal(false);
  readonly exportDataAccessGroups = signal(false);
  readonly variables = signal<Redcap2VariableRow[]>([]);
  readonly pseudonymizationKey = signal('');
  readonly loadingVariables = signal(false);
  readonly lastLoadedReportId = signal('');
  readonly expandedPanels = signal<string[]>(['0', '1', '2']);
  // Increments per variables request; stale responses are discarded.
  private loadSeq = 0;

  readonly usesPseudonymization = computed(() =>
    this.variables().some(
      (variable) => variable.anonymization === 'pseudonymize',
    ),
  );

  readonly dataFormatItems: SelectItem<string>[] = [
    { label: 'CSV', value: 'csv' },
    { label: 'JSON', value: 'json' },
  ];

  readonly recordTypeItems: SelectItem<string>[] = [
    { label: 'Flat', value: 'flat' },
    { label: 'EAV', value: 'eav' },
  ];

  readonly csvDelimiterItems: SelectItem<string>[] = [
    { label: 'Comma (,)', value: ',' },
    { label: 'Tab', value: 'tab' },
  ];

  readonly anonymizationItems: SelectItem<string>[] = [
    { label: 'None', value: 'none' },
    { label: 'Blank', value: 'blank' },
    { label: 'Drop', value: 'drop' },
    { label: 'Pseudonymize', value: 'pseudonymize' },
  ];

  // "both" is not a real REDCap API value — only raw and label exist.
  readonly rawOrLabelItems: SelectItem<string>[] = [
    { label: 'Raw', value: 'raw' },
    { label: 'Label', value: 'label' },
  ];

  readonly rawOrLabelHeadersItems: SelectItem<string>[] = [
    { label: 'Raw', value: 'raw' },
    { label: 'Label', value: 'label' },
  ];

  ngOnInit(): void {
    const creds = this.credentialsService.credentials$();
    if (creds.plugin !== 'redcap2') {
      this.notificationService.showError(
        'This page is only available for redcap2.',
      );
      void this.router.navigate(['/connect']);
      return;
    }

    // Report ID may come from a previous visit (saved in plugin_options)
    // or be empty for a first visit — the user enters it on this page.
    const reportId = (creds.option ?? '').trim();
    this.reportId.set(reportId);

    const savedVariableModes = this.applySavedPluginOptions(
      creds.plugin_options,
    );
    if (this.exportMode() === 'records' || this.reportId().trim()) {
      this.loadVariables(savedVariableModes);
    }
  }

  setExportMode(mode: 'report' | 'records'): void {
    if (this.exportMode() === mode) {
      return;
    }
    this.exportMode.set(mode);
    this.variables.set([]);
    this.lastLoadedReportId.set('');
    if (mode === 'records' || this.reportId().trim()) {
      this.loadVariables(new Map());
    }
  }

  // Loads the variable list when the user finishes typing a (new) report ID —
  // without this, identifier auto-blanking would silently be skipped on the
  // first visit.
  onReportIdBlur(): void {
    const id = this.reportId().trim();
    if (
      this.exportMode() === 'report' &&
      id !== '' &&
      id !== this.lastLoadedReportId()
    ) {
      this.loadVariables(new Map());
    }
  }

  reloadVariables(): void {
    if (this.exportMode() === 'report' && this.reportId().trim() === '') {
      this.notificationService.showError('Enter a report ID first.');
      return;
    }
    this.loadVariables(new Map());
  }

  goBack(): void {
    void this.router.navigate(['/connect']);
  }

  continueToCompare(): void {
    const datasetId =
      this.route.snapshot.paramMap.get('id') ??
      this.credentialsService.datasetId$();
    const mode = this.exportMode();
    const reportId = this.reportId().trim();

    if (!datasetId) {
      this.notificationService.showError('Dataset ID is missing.');
      return;
    }
    if (mode === 'report' && !reportId) {
      this.notificationService.showError('Report ID is missing.');
      return;
    }

    const usesPseudonymization = this.usesPseudonymization();
    const pseudonymizationKey = this.pseudonymizationKey().trim();
    if (usesPseudonymization) {
      const keyBytes = this.decodedKeyLength(pseudonymizationKey);
      if (keyBytes < 0) {
        this.notificationService.showError(
          'The pseudonymization key is not valid base64. Generate one with: openssl rand -base64 32',
        );
        return;
      }
      if (keyBytes < MIN_PSEUDONYMIZATION_KEY_BYTES) {
        this.notificationService.showError(
          `The pseudonymization key is too short (${keyBytes} bytes decoded, minimum ${MIN_PSEUDONYMIZATION_KEY_BYTES}). Generate one with: openssl rand -base64 32`,
        );
        return;
      }
    }

    const options: Redcap2PluginOptions = {
      exportMode: mode,
      reportId: mode === 'report' ? reportId : undefined,
      dataFormat: this.dataFormat(),
      // Report exports are always flat (content=report has no type parameter).
      recordType: mode === 'records' ? this.recordType() : 'flat',
      csvDelimiter: this.csvDelimiter(),
      rawOrLabel: this.rawOrLabel(),
      rawOrLabelHeaders: this.rawOrLabelHeaders(),
      // The display-only PHI-risk note is stripped from the submitted options.
      variables: this.variables().map(({ name, anonymization }) => ({
        name,
        anonymization,
      })),
      pseudonymizationKey: usesPseudonymization
        ? pseudonymizationKey
        : undefined,
      generatedAt: new Date().toISOString(),
      ...(mode === 'records' && {
        exportSurveyFields: this.exportSurveyFields(),
        exportDataAccessGroups: this.exportDataAccessGroups(),
        fields: this.parseList(this.fieldsInput()),
        forms: this.parseList(this.formsInput()),
        events: this.parseList(this.eventsInput()),
        records: this.parseList(this.recordsInput()),
        filterLogic: this.trimOrUndefined(this.filterLogic()),
        dateRangeBegin: this.trimOrUndefined(this.dateRangeBegin()),
        dateRangeEnd: this.trimOrUndefined(this.dateRangeEnd()),
      }),
    };

    this.credentialsService.updateCredentials({
      option: mode === 'report' ? reportId : '',
      plugin_options: JSON.stringify(options),
    });
    this.dataStateService.resetState();

    const state = window.history.state as {
      collectionId?: string;
      collectionItems?: unknown;
    };
    void this.router.navigate(['/compare', datasetId], {
      state: {
        collectionId: state?.collectionId,
        collectionItems: state?.collectionItems,
      },
    });
  }

  setVariableAnonymization(name: string, anonymization: string): void {
    const normalized = this.normalizeAnonymization(anonymization);
    this.variables.set(
      this.variables().map((variable) =>
        variable.name === name
          ? { ...variable, anonymization: normalized }
          : variable,
      ),
    );
  }

  private normalizeAnonymization(value: unknown): Redcap2Anonymization {
    return value === 'blank' || value === 'drop' || value === 'pseudonymize'
      ? value
      : 'none';
  }

  // Returns the decoded byte length of a base64 key, or -1 when invalid.
  private decodedKeyLength(key: string): number {
    try {
      return atob(key).length;
    } catch {
      return -1;
    }
  }

  private applySavedPluginOptions(
    raw?: string,
  ): Map<string, Redcap2Anonymization> {
    const modes = new Map<string, Redcap2Anonymization>();
    if (!raw || raw.trim() === '') {
      return modes;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<Redcap2PluginOptions>;
      const savedMode = parsed.exportMode === 'records' ? 'records' : 'report';
      this.exportMode.set(savedMode);

      // For report mode, discard options from a different report.
      if (
        savedMode === 'report' &&
        parsed.reportId &&
        parsed.reportId !== this.reportId()
      ) {
        return modes;
      }

      if (parsed.dataFormat === 'json' || parsed.dataFormat === 'csv') {
        this.dataFormat.set(parsed.dataFormat);
      }
      if (parsed.recordType === 'eav' || parsed.recordType === 'flat') {
        this.recordType.set(parsed.recordType);
      }
      if (parsed.csvDelimiter === ',' || parsed.csvDelimiter === 'tab') {
        this.csvDelimiter.set(parsed.csvDelimiter);
      }
      if (parsed.rawOrLabel === 'raw' || parsed.rawOrLabel === 'label') {
        this.rawOrLabel.set(parsed.rawOrLabel);
      }
      if (
        parsed.rawOrLabelHeaders === 'raw' ||
        parsed.rawOrLabelHeaders === 'label'
      ) {
        this.rawOrLabelHeaders.set(parsed.rawOrLabelHeaders);
      }

      if (savedMode === 'records') {
        this.fieldsInput.set(this.toInputList(parsed.fields));
        this.formsInput.set(this.toInputList(parsed.forms));
        this.eventsInput.set(this.toInputList(parsed.events));
        this.recordsInput.set(this.toInputList(parsed.records));
        this.filterLogic.set(parsed.filterLogic ?? '');
        this.dateRangeBegin.set(parsed.dateRangeBegin ?? '');
        this.dateRangeEnd.set(parsed.dateRangeEnd ?? '');
        this.exportSurveyFields.set(parsed.exportSurveyFields ?? false);
        this.exportDataAccessGroups.set(parsed.exportDataAccessGroups ?? false);
      }

      if (typeof parsed.pseudonymizationKey === 'string') {
        this.pseudonymizationKey.set(parsed.pseudonymizationKey);
      }

      for (const variable of parsed.variables ?? []) {
        if (!variable?.name) {
          continue;
        }
        modes.set(
          variable.name,
          this.normalizeAnonymization(variable.anonymization),
        );
      }
    } catch {
      // Ignore stale or malformed settings and continue with defaults.
    }

    return modes;
  }

  private loadVariables(savedModes: Map<string, Redcap2Anonymization>): void {
    const creds = this.credentialsService.credentials$();
    const mode = this.exportMode();
    const reportId = mode === 'report' ? this.reportId().trim() : '';
    const seq = ++this.loadSeq;
    const req: RepoLookupRequest = {
      pluginId: creds.pluginId,
      plugin: creds.plugin,
      repoName: creds.repo_name,
      option: reportId,
      url: creds.url,
      user: creds.user,
      token: creds.token,
      pluginOptions: JSON.stringify({
        request: 'variables',
        exportMode: mode,
        reportId: reportId,
      }),
    };

    this.loadingVariables.set(true);
    this.repoLookupService
      .getOptions(req)
      .pipe(take(1))
      .subscribe({
        next: (items) => {
          if (seq !== this.loadSeq) {
            return; // a newer request superseded this one
          }
          const identifierFields = new Set(
            items
              .filter((item) => item.selected)
              .map((item) => String(item.value ?? item.label ?? '').trim())
              .filter((name) => name !== ''),
          );
          const noteByName = new Map<string, string>();
          for (const item of items) {
            const name = String(item.value ?? item.label ?? '').trim();
            if (name !== '' && item.note) {
              noteByName.set(name, item.note);
            }
          }
          const names = Array.from(
            new Set(
              items
                .map((item) => String(item.value ?? item.label ?? '').trim())
                .filter((name) => name !== ''),
            ),
          ).sort((a, b) => a.localeCompare(b));

          this.variables.set(
            names.map((name) => {
              const row: Redcap2VariableRow = {
                name,
                anonymization:
                  savedModes.get(name) ??
                  (identifierFields.has(name) ? 'blank' : 'none'),
              };
              const note = noteByName.get(name);
              return note ? { ...row, note } : row;
            }),
          );
          this.lastLoadedReportId.set(reportId);
          this.loadingVariables.set(false);
        },
        error: (err) => {
          if (seq !== this.loadSeq) {
            return;
          }
          this.loadingVariables.set(false);
          this.notificationService.showError(
            `Variable lookup failed: ${this.errorMessage(err)}`,
          );
        },
      });
  }

  private toInputList(values?: string[]): string {
    if (!values || values.length === 0) {
      return '';
    }
    return values.join(', ');
  }

  private parseList(raw: string): string[] | undefined {
    const values = Array.from(
      new Set(
        raw
          .split(',')
          .map((value) => value.trim())
          .filter((value) => value !== ''),
      ),
    );
    return values.length > 0 ? values : undefined;
  }

  private trimOrUndefined(raw: string): string | undefined {
    const trimmed = raw.trim();
    return trimmed === '' ? undefined : trimmed;
  }

  private errorMessage(err: unknown): string {
    if (typeof err === 'string') {
      return err;
    }
    if (typeof err === 'object' && err !== null) {
      const asObj = err as Record<string, unknown>;
      if (typeof asObj['error'] === 'string') {
        return asObj['error'];
      }
      if (typeof asObj['message'] === 'string') {
        return asObj['message'];
      }
    }
    return 'Unknown error';
  }
}
