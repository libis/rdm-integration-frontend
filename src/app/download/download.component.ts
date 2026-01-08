// Author: Eryk Kulikowski @ KU Leuven (2024). Apache 2.0 License

import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';

// Services
import { ActivatedRoute } from '@angular/router';
import { DataService } from '../data.service';
import { DvObjectLookupService } from '../dvobject.lookup.service';
import { OauthService } from '../oauth.service';
import { PluginService } from '../plugin.service';
import { RepoLookupService } from '../repo.lookup.service';
import { NavigationService } from '../shared/navigation.service';
import { NotificationService } from '../shared/notification.service';
import { SubmitService } from '../submit.service';
import { UtilsService } from '../utils.service';

// Models
import { CompareResult } from '../models/compare-result';
import { Datafile, Fileaction } from '../models/datafile';
import { LoginState } from '../models/oauth';
import { RepoPlugin } from '../models/plugin';
import { RepoLookupRequest } from '../models/repo-lookup';

// PrimeNG
import { FormsModule } from '@angular/forms';
import { PrimeTemplate, SelectItem, TreeNode } from 'primeng/api';
import { Button, ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { Select } from 'primeng/select';
import { Tree } from 'primeng/tree';
import { TreeTableModule } from 'primeng/treetable';

// Components
import { DownladablefileComponent } from '../downloadablefile/downladablefile.component';
import { TransferProgressCardComponent } from '../shared/transfer-progress-card/transfer-progress-card.component';

// RxJS
import {
  debounceTime,
  firstValueFrom,
  map,
  Observable,
  Subject,
  Subscription,
} from 'rxjs';

// Constants and types
import { APP_CONSTANTS } from '../shared/constants';
import { SubscriptionManager } from '../shared/types';

@Component({
  selector: 'app-download',
  templateUrl: './download.component.html',
  styleUrl: './download.component.scss',
  imports: [
    CommonModule,
    Button,
    ButtonDirective,
    Dialog,
    FormsModule,
    InputTextModule,
    Select,
    TreeTableModule,
    PrimeTemplate,
    DownladablefileComponent,
    Tree,
    ProgressSpinnerModule,
    TransferProgressCardComponent,
  ],
})
export class DownloadComponent
  implements OnInit, OnDestroy, SubscriptionManager
{
  private readonly dvObjectLookupService = inject(DvObjectLookupService);
  readonly pluginService = inject(PluginService);
  dataService = inject(DataService);
  submit = inject(SubmitService);
  private readonly utils = inject(UtilsService);
  private readonly route = inject(ActivatedRoute);
  private readonly repoLookupService = inject(RepoLookupService);
  private readonly oauth = inject(OauthService);
  private readonly notificationService = inject(NotificationService);
  private readonly navigation = inject(NavigationService);

  // CONSTANTS
  readonly DEBOUNCE_TIME = APP_CONSTANTS.DEBOUNCE_TIME;

  // NG MODEL FIELDS
  dataverseToken?: string;
  datasetId?: string;
  data?: CompareResult;
  rootNodeChildren: TreeNode<Datafile>[] = [];
  rowNodeMap: Map<string, TreeNode<Datafile>> = new Map<
    string,
    TreeNode<Datafile>
  >();
  loading = false;

  // ITEMS IN SELECTS
  loadingItem: SelectItem<string> = { label: `Loading...`, value: 'loading' };
  loadingItems: SelectItem<string>[] = [this.loadingItem];
  doiItems: SelectItem<string>[] = [];

  // INTERNAL STATE VARIABLES
  datasetSearchSubject: Subject<string> = new Subject();
  datasetSearchResultsObservable: Observable<Promise<SelectItem<string>[]>>;
  datasetSearchResultsSubscription?: Subscription;
  downloadRequested = false;
  downloadInProgress = false;
  lastTransferTaskId?: string;
  globusMonitorUrl?: string;
  statusPollingActive = false;
  done = false;
  datasetUrl = '';
  showGuestLoginPopup = false;
  previewUrlInput = '';
  // Access mode: 'guest' | 'preview' | 'login' - tracks user's choice for Globus session
  accessMode: 'guest' | 'preview' | 'login' = 'guest';

  // globus
  token?: string;
  repoNames: SelectItem<string>[] = [];
  selectedRepoName?: string;
  foundRepoName?: string;
  repoSearchSubject: Subject<string> = new Subject();
  repoSearchResultsObservable: Observable<Promise<SelectItem<string>[]>>;
  repoSearchResultsSubscription?: Subscription;
  branchItems: SelectItem<string>[] = [];
  option?: string;
  rootOptions: TreeNode<string>[] = [
    { label: 'Expand and select', data: '', leaf: false, selectable: true },
  ];
  selectedOption?: TreeNode<string>;
  optionsLoading = false;
  globusPlugin?: RepoPlugin;
  downloadId?: string;
  datasetDbId?: string; // Database ID for preview URL users

  constructor() {
    this.datasetSearchResultsObservable = this.datasetSearchSubject.pipe(
      debounceTime(this.DEBOUNCE_TIME),
      map((searchText) => this.datasetSearch(searchText)),
    );
    this.repoSearchResultsObservable = this.repoSearchSubject.pipe(
      debounceTime(this.DEBOUNCE_TIME),
      map((searchText) => this.repoNameSearch(searchText)),
    );
  }

  async ngOnInit() {
    await this.pluginService.setConfig();
    // eslint-disable-next-line no-console
    console.debug('[DownloadComponent] Config loaded');

    // Get initial params to check if this is an OAuth callback
    const initialParams = await firstValueFrom(this.route.queryParams);
    const isOAuthCallback = initialParams['code'] !== undefined;

    // Check if user is logged in and show popup if not
    // But skip popup for OAuth callbacks - user already made their choice
    // eslint-disable-next-line no-console
    console.debug('[DownloadComponent] Checking user info for popup...');
    if (!isOAuthCallback) {
      try {
        const userInfo = await firstValueFrom(this.dataService.getUserInfo());
        // eslint-disable-next-line no-console
        console.debug('[DownloadComponent] getUserInfo response:', userInfo);
        if (!userInfo.loggedIn) {
          // eslint-disable-next-line no-console
          console.debug(
            '[DownloadComponent] User not logged in, showing popup',
          );
          this.showGuestLoginPopup = true;
        } else {
          // eslint-disable-next-line no-console
          console.debug(
            '[DownloadComponent] User is logged in, no popup needed',
          );
          // Logged-in users should keep session_required_single_domain
          this.accessMode = 'login';
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[DownloadComponent] getUserInfo error:', err);
        // eslint-disable-next-line no-console
        console.debug(
          '[DownloadComponent] Assuming not logged in, showing popup',
        );
        this.showGuestLoginPopup = true;
      }
    } else {
      // eslint-disable-next-line no-console
      console.debug(
        '[DownloadComponent] OAuth callback detected, skipping popup',
      );
    }

    this.route.queryParams.subscribe((params) => {
      // eslint-disable-next-line no-console
      console.debug('[DownloadComponent] Route params received:', params);

      const apiToken = params['apiToken'];
      if (apiToken) {
        this.dataverseToken = apiToken;
      }
      // token param is passed for preview URL users from the Dataverse callback
      const token = params['token'];
      if (token) {
        this.dataverseToken = token;
        this.accessMode = 'preview';
        // eslint-disable-next-line no-console
        console.debug(
          '[DownloadComponent] Got token from params (preview mode)',
        );
      }
      const pid = params['datasetPid'];
      if (pid) {
        this.doiItems = [{ label: pid, value: pid }];
        this.datasetId = pid;
      }
      this.downloadId = params['downloadId'];
      // datasetDbId is passed when getDatasetVersion fails (preview URL users)
      if (params['datasetDbId']) {
        this.datasetDbId = params['datasetDbId'];
        // eslint-disable-next-line no-console
        console.debug(
          '[DownloadComponent] Got datasetDbId from params:',
          this.datasetDbId,
        );
      }

      // If we have datasetDbId and downloadId but no DOI, fetch it now
      if (this.datasetDbId && this.downloadId && !this.datasetId) {
        // eslint-disable-next-line no-console
        console.debug(
          '[DownloadComponent] Auto-fetching DOI from globusDownloadParameters',
        );
        this.fetchDoiFromGlobusParams();
      }

      const code = params['code'];
      if (code !== undefined) {
        // eslint-disable-next-line no-console
        console.debug('[DownloadComponent] OAuth callback detected');
        const loginState: LoginState = JSON.parse(params['state']);
        // eslint-disable-next-line no-console
        console.debug('[DownloadComponent] LoginState:', loginState);
        if (loginState.nonce) {
          const doi = loginState.datasetId?.value
            ? loginState.datasetId?.value
            : '?';
          this.doiItems = [{ label: doi, value: doi }];
          this.datasetId = doi;

          // Restore state from OAuth redirect
          if (loginState.downloadId) {
            this.downloadId = loginState.downloadId;
          }
          if (loginState.accessMode) {
            this.accessMode = loginState.accessMode;
          }

          // eslint-disable-next-line no-console
          console.debug('[DownloadComponent] State after restore:', {
            doi,
            downloadId: this.downloadId,
            accessMode: this.accessMode,
          });

          // Load files if we have a valid dataset ID (DOI was fetched before OAuth)
          if (doi && doi !== '?' && doi !== 'undefined') {
            this.onDatasetChange();
          }

          const tokenSubscription = this.oauth
            .getToken('globus', code, loginState.nonce)
            .subscribe((x) => {
              this.token = x.session_id;

              tokenSubscription.unsubscribe();
            });
        }
        this.globusPlugin = this.pluginService.getGlobusPlugin();
      } else {
        // First arrival - only redirect if user is logged in (popup not shown)
        this.globusPlugin = this.pluginService.getGlobusPlugin();
        if (!this.showGuestLoginPopup) {
          this.getRepoToken();
        }
      }
    });
    this.datasetSearchResultsSubscription =
      this.datasetSearchResultsObservable.subscribe({
        next: (x) =>
          x
            .then((v) => (this.doiItems = v))
            .catch(
              (err) =>
                (this.doiItems = [
                  {
                    label: `search failed: ${err.message}`,
                    value: err.message,
                  },
                ]),
            ),
        error: (err) =>
          (this.doiItems = [
            { label: `search failed: ${err.message}`, value: err.message },
          ]),
      });
    this.repoSearchResultsSubscription =
      this.repoSearchResultsObservable.subscribe({
        next: (x) =>
          x
            .then((v) => (this.repoNames = v))
            .catch(
              (err) =>
                (this.repoNames = [
                  {
                    label: `search failed: ${err.message}`,
                    value: err.message,
                  },
                ]),
            ),
        error: (err) =>
          (this.repoNames = [
            { label: `search failed: ${err.message}`, value: err.message },
          ]),
      });

    // Auto-load dataset options on init
    this.getDoiOptions();
  }

  ngOnDestroy() {
    this.datasetSearchResultsSubscription?.unsubscribe();
    this.repoSearchResultsSubscription?.unsubscribe();
  }

  back(): void {
    this.navigation.assign('connect');
  }

  showDVToken(): boolean {
    return this.pluginService.showDVToken();
  }

  redirectToLogin(): void {
    this.pluginService.redirectToLogin();
  }

  continueAsGuest(): void {
    // User chose to continue as guest - now redirect to Globus OAuth
    this.accessMode = 'guest';
    this.showGuestLoginPopup = false;
    this.getRepoToken();
  }

  continueWithPreviewUrl(): void {
    // User chose to continue with preview URL - extract token and datasetDbId, then fetch DOI
    const parsed = this.extractFromPreviewUrl(this.previewUrlInput);
    if (!parsed?.token) {
      // eslint-disable-next-line no-console
      console.error('[DownloadComponent] Could not extract token from input');
      return;
    }
    this.dataverseToken = parsed.token;
    if (parsed.datasetDbId) {
      this.datasetDbId = parsed.datasetDbId;
    }
    this.accessMode = 'preview';
    this.showGuestLoginPopup = false;

    // If we have datasetDbId and downloadId, fetch DOI BEFORE going to OAuth
    if (this.datasetDbId && this.downloadId) {
      this.loading = true;
      const dataverseUrl = this.pluginService.getExternalURL();
      // eslint-disable-next-line no-console
      console.debug(
        '[DownloadComponent] Fetching DOI before OAuth. datasetDbId:',
        this.datasetDbId,
        'downloadId:',
        this.downloadId,
      );
      this.dataService
        .getGlobusDownloadParams(
          dataverseUrl,
          this.datasetDbId,
          this.downloadId,
          this.dataverseToken,
        )
        .subscribe({
          next: (response) => {
            this.loading = false;
            const pid = response.data?.queryParameters?.datasetPid;
            if (pid) {
              // eslint-disable-next-line no-console
              console.debug('[DownloadComponent] Got DOI:', pid);
              this.datasetId = pid;
              this.doiItems = [{ label: pid, value: pid }];
            }
            // Now proceed to OAuth with DOI already known
            this.getRepoToken();
          },
          error: (err) => {
            this.loading = false;
            // eslint-disable-next-line no-console
            console.error(
              '[DownloadComponent] Failed to fetch DOI, proceeding anyway:',
              err,
            );
            // Proceed anyway - might work without DOI
            this.getRepoToken();
          },
        });
    } else {
      // No datasetDbId available, just proceed
      this.getRepoToken();
    }
  }

  continueWithLogin(): void {
    // User chose to log in - redirect to Dataverse login first
    // After login, they'll return as logged in user and Globus OAuth will happen with session_required_single_domain
    this.showGuestLoginPopup = false;
    this.redirectToLogin();
  }

  /**
   * Fetches the DOI from globusDownloadParameters API using datasetDbId.
   * Called automatically when we have datasetDbId but no DOI.
   * Token is optional - API may work without it for signed URLs.
   */
  private fetchDoiFromGlobusParams(): void {
    if (!this.datasetDbId || !this.downloadId) {
      return;
    }
    this.loading = true;
    const dataverseUrl = this.pluginService.getExternalURL();
    // eslint-disable-next-line no-console
    console.debug(
      '[DownloadComponent] Fetching DOI. datasetDbId:',
      this.datasetDbId,
      'downloadId:',
      this.downloadId,
    );
    this.dataService
      .getGlobusDownloadParams(
        dataverseUrl,
        this.datasetDbId,
        this.downloadId,
        this.dataverseToken,
      )
      .subscribe({
        next: (response) => {
          this.loading = false;
          const pid = response.data?.queryParameters?.datasetPid;
          if (pid) {
            // eslint-disable-next-line no-console
            console.debug('[DownloadComponent] Got DOI:', pid);
            this.datasetId = pid;
            this.doiItems = [{ label: pid, value: pid }];
            // Now that we have DOI, proceed to OAuth if popup not shown
            if (!this.showGuestLoginPopup) {
              this.getRepoToken();
            }
          }
        },
        error: (err) => {
          this.loading = false;
          // eslint-disable-next-line no-console
          console.error('[DownloadComponent] Failed to fetch DOI:', err);
        },
      });
  }

  /**
   * Extract both token and datasetDbId from user input.
   * Input can be:
   * 1. Just a UUID token
   * 2. A preview URL: https://.../previewurl.xhtml?token=xxx
   * 3. A full callback URL: https://.../api/v1/datasets/1234/globusDownloadParameters?downloadId=xxx&token=xxx
   */
  extractFromPreviewUrl(input: string): {
    token: string | null;
    datasetDbId: string | null;
  } {
    if (!input) return { token: null, datasetDbId: null };
    const trimmed = input.trim();

    // If it's just a UUID-like token, return it directly
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidPattern.test(trimmed)) {
      return { token: trimmed, datasetDbId: null };
    }

    let token: string | null = null;
    let datasetDbId: string | null = null;

    // Try to parse as URL
    try {
      const url = new URL(trimmed);
      token = url.searchParams.get('token');
      // Extract datasetDbId from path like /api/v1/datasets/1234/...
      const datasetMatch = url.pathname.match(/\/datasets\/(\d+)/);
      if (datasetMatch) {
        datasetDbId = datasetMatch[1];
      }
    } catch {
      // Not a valid URL, try regex fallback
      const tokenMatch = trimmed.match(
        /token=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
      );
      if (tokenMatch) token = tokenMatch[1];

      const datasetMatch = trimmed.match(/\/datasets\/(\d+)/);
      if (datasetMatch) datasetDbId = datasetMatch[1];
    }

    return { token, datasetDbId };
  }

  onUserChange() {
    this.doiItems = [];
    this.datasetId = undefined;
  }

  // DV OBJECTS: COMMON
  getDoiOptions(): void {
    // Don't reload if we already have valid options (not just '?' or loading)
    if (
      this.doiItems.length !== 0 &&
      this.doiItems.find((x) => x === this.loadingItem) === undefined &&
      this.datasetId !== '?'
    ) {
      return;
    }
    this.doiItems = this.loadingItems;
    this.datasetId = undefined;

    const httpSubscription = this.dvObjectLookupService
      .getItems('', 'Dataset', undefined, this.dataverseToken, true)
      .subscribe({
        next: (items: SelectItem<string>[]) => {
          if (items && items.length > 0) {
            this.doiItems = items;
            this.datasetId = undefined;
          } else {
            this.doiItems = [];
            this.datasetId = undefined;
          }
          httpSubscription.unsubscribe();
        },
        error: (err) => {
          this.notificationService.showError(`DOI lookup failed: ${err.error}`);
          this.doiItems = [];
          this.datasetId = undefined;
        },
      });
  }

  // DATASETS
  datasetFieldEditable(): boolean {
    return this.pluginService.datasetFieldEditable();
  }

  onDatasetSearch(searchTerm: string | null) {
    if (searchTerm === null || searchTerm.length < 3) {
      this.doiItems = [
        {
          label: 'start typing to search (at least three letters)',
          value: 'start',
        },
      ];
      return;
    }
    this.doiItems = [
      { label: `searching "${searchTerm}"...`, value: searchTerm },
    ];
    this.datasetSearchSubject.next(searchTerm);
  }

  async datasetSearch(searchTerm: string): Promise<SelectItem<string>[]> {
    return await firstValueFrom(
      this.dvObjectLookupService.getItems(
        '',
        'Dataset',
        searchTerm,
        this.dataverseToken,
        true,
      ),
    );
  }

  onDatasetChange() {
    this.loading = true;
    const subscription = this.dataService
      .getDownloadableFiles(this.datasetId!, this.dataverseToken)
      .subscribe({
        next: (data) => {
          subscription.unsubscribe();
          data.data = data.data?.sort((o1, o2) =>
            (o1.id === undefined ? '' : o1.id) <
            (o2.id === undefined ? '' : o2.id)
              ? -1
              : 1,
          );
          this.setData(data);
        },
        error: (err) => {
          subscription.unsubscribe();
          this.notificationService.showError(
            `Getting downloadable files failed: ${err.error}`,
          );
        },
      });
  }

  setData(data: CompareResult): void {
    this.data = data;
    this.datasetUrl = data.url || '';
    if (!data.data || data.data.length === 0) {
      this.loading = false;
      return;
    }
    const rowDataMap = this.utils.mapDatafiles(data.data);
    rowDataMap.forEach((v) => this.utils.addChild(v, rowDataMap));
    const rootNode = rowDataMap.get('');
    this.rowNodeMap = rowDataMap;
    if (rootNode?.children) {
      this.rootNodeChildren = rootNode.children;
    }
    this.loading = false;
  }

  action(): string {
    const root = this.rowNodeMap.get('');
    if (root) {
      return DownladablefileComponent.actionIcon(root);
    }
    return DownladablefileComponent.icon_ignore;
  }

  toggleAction(): void {
    const root = this.rowNodeMap.get('');
    if (root) {
      DownladablefileComponent.toggleNodeAction(root);
    }
  }

  downloadDisabled(): boolean {
    return (
      this.downloadRequested ||
      this.downloadInProgress ||
      this.statusPollingActive ||
      !this.option ||
      !Array.from(this.rowNodeMap.values()).some(
        (x) => x.data?.action === Fileaction.Download,
      )
    );
  }

  async download(): Promise<void> {
    const selected: Datafile[] = [];
    this.rowNodeMap.forEach((datafile) => {
      if (datafile.data?.action === Fileaction.Download) {
        selected.push(datafile.data);
      }
    });

    if (selected.length === 0) {
      this.notificationService.showError(
        'Select at least one file before requesting a download.',
      );
      return;
    }

    this.downloadRequested = true;
    this.downloadInProgress = true;
    this.lastTransferTaskId = undefined;
    this.globusMonitorUrl = undefined;
    this.statusPollingActive = false;

    this.submit
      .download(
        selected,
        this.getRepoName(),
        this.option,
        this.token,
        this.datasetId,
        this.dataverseToken,
        this.downloadId,
      )
      .subscribe({
        next: (response) => {
          this.downloadRequested = false;
          this.downloadInProgress = false;

          const taskId = response?.taskId ?? '';
          if (!taskId) {
            this.notificationService.showSuccess('Download request submitted.');
            return;
          }

          this.lastTransferTaskId = taskId;
          this.globusMonitorUrl =
            response.monitorUrl ?? this.buildGlobusMonitorUrl(taskId);
          this.notificationService.showSuccess(
            `Download request started. Globus task ID: ${taskId}`,
          );
        },
        error: (err: unknown) => {
          this.downloadRequested = false;
          this.downloadInProgress = false;
          this.statusPollingActive = false;

          console.error('something went wrong:');
          console.error(err);
          const fallbackError = 'unknown error';
          const message =
            (err as { error?: string; message?: string })?.error ??
            (err as { message?: string })?.message ??
            fallbackError;
          this.notificationService.showError(
            `Download request failed: ${message}`,
          );
        },
      });
  }

  onStatusPollingChange(active: boolean): void {
    this.statusPollingActive = active;
  }

  goToDataset(): void {
    if (this.datasetUrl) {
      window.open(this.datasetUrl, '_blank');
    }
  }

  private buildGlobusMonitorUrl(taskId: string): string {
    if (!taskId) {
      return '';
    }
    return `https://app.globus.org/activity/${encodeURIComponent(taskId)}`;
  }

  // globus
  getRepoNameFieldName(): string | undefined {
    return this.globusPlugin?.repoNameFieldName;
  }

  getRepoName(): string | undefined {
    if (this.selectedRepoName !== undefined) {
      return this.selectedRepoName;
    }
    return this.foundRepoName;
  }

  async repoNameSearch(searchTerm: string): Promise<SelectItem<string>[]> {
    const req = this.getRepoLookupRequest(true);
    if (req === undefined) {
      return [{ label: 'error', value: 'error' }];
    }
    req.repoName = searchTerm;
    return await firstValueFrom(this.repoLookupService.search(req));
  }

  getRepoLookupRequest(isSearch: boolean): RepoLookupRequest | undefined {
    if (
      this.getRepoNameFieldName() &&
      (this.getRepoName() === undefined || this.getRepoName() === '') &&
      !isSearch
    ) {
      this.notificationService.showError(
        `${this.getRepoNameFieldName()} is missing`,
      );
      return;
    }
    if (
      this.branchItems.length !== 0 &&
      this.branchItems.find((x) => x === this.loadingItem) === undefined
    ) {
      return;
    }
    this.branchItems = this.loadingItems;

    return {
      pluginId: 'globus',
      plugin: 'globus',
      repoName: this.getRepoName(),
      url: this.globusPlugin?.sourceUrlFieldValue,
      token: this.token,
    };
  }

  repoNameFieldEditable(): boolean {
    const v = this.globusPlugin?.repoNameFieldEditable;
    return v === undefined ? false : v;
  }

  getRepoNamePlaceholder(): string {
    const v = this.globusPlugin?.repoNameFieldPlaceholder;
    return v === undefined ? '' : v;
  }

  onRepoNameSearch(searchTerm: string | null) {
    if (searchTerm === null || searchTerm.length < 3) {
      this.repoNames = [
        {
          label: 'start typing to search (at least three letters)',
          value: 'start',
        },
      ];
      return;
    }
    this.repoNames = [
      { label: `searching "${searchTerm}"...`, value: searchTerm },
    ];
    this.repoSearchSubject.next(searchTerm);
  }

  startRepoSearch() {
    if (this.foundRepoName !== undefined) {
      return;
    }
    if (this.repoNameSearchInitEnabled()) {
      this.repoNames = [{ label: 'loading...', value: 'start' }];
      this.repoSearchSubject.next('');
    } else {
      this.repoNames = [
        {
          label: 'start typing to search (at least three letters)',
          value: 'start',
        },
      ];
    }
  }

  repoNameSearchInitEnabled(): boolean | undefined {
    return this.globusPlugin?.repoNameFieldHasInit;
  }

  getOptionFieldName(): string | undefined {
    return this.globusPlugin?.optionFieldName;
  }

  getOptions(node?: TreeNode<string>): void {
    const req = this.getRepoLookupRequest(false);
    if (req === undefined) {
      return;
    }
    if (node) {
      req.option = node.data;
      this.optionsLoading = true;
    }

    const httpSubscription = this.repoLookupService.getOptions(req).subscribe({
      next: (items: SelectItem<string>[]) => {
        if (items && node) {
          const nodes: TreeNode<string>[] = [];
          items.forEach((i) =>
            nodes.push({
              label: i.label,
              data: i.value,
              leaf: false,
              selectable: true,
            }),
          );
          node.children = nodes;
          this.optionsLoading = false;
        } else if (items && items.length > 0) {
          this.branchItems = items;
        } else {
          this.branchItems = [];
        }
        httpSubscription.unsubscribe();
      },
      error: (err) => {
        this.notificationService.showError(
          `Branch lookup failed: ${err.error}`,
        );
        this.branchItems = [];
        this.option = undefined;
        this.optionsLoading = false;
      },
    });
  }

  optionSelected(node: TreeNode<string>): void {
    const v = node.data;
    if (!v || v === '') {
      this.selectedOption = undefined;
      this.option = undefined;
    } else {
      this.option = v;
      this.selectedOption = node;
    }
  }

  onRepoChange() {
    this.branchItems = [];
    this.option = undefined;
  }

  getRepoToken() {
    const tg = this.globusPlugin?.tokenGetter;
    if (tg === undefined) {
      return;
    }
    let url =
      this.globusPlugin?.sourceUrlFieldValue +
      (tg.URL === undefined ? '' : tg.URL);
    if (tg.URL?.includes('://')) {
      url = tg.URL;
    }
    // For guest/preview users, strip session_required_single_domain to allow any Globus identity
    if (this.accessMode === 'guest' || this.accessMode === 'preview') {
      url = url.replace(/[&?]session_required_single_domain=[^&]*/g, '');
    }
    if (tg.oauth_client_id !== undefined && tg.oauth_client_id !== '') {
      const nonce = this.newNonce(44);
      // Include all state to preserve across OAuth redirect
      const loginState: LoginState = {
        datasetId:
          this.datasetId && this.datasetId !== '?'
            ? { value: this.datasetId, label: this.datasetId }
            : undefined,
        nonce: nonce,
        download: true,
        downloadId: this.downloadId,
        accessMode: this.accessMode,
      };
      // eslint-disable-next-line no-console
      console.debug('[DownloadComponent] getRepoToken loginState:', {
        ...loginState,
      });
      let clId = '?client_id=';
      if (url.includes('?')) {
        clId = '&client_id=';
      }
      url = `${
        url + clId + encodeURIComponent(tg.oauth_client_id)
      }&redirect_uri=${this.pluginService.getRedirectUri()}&response_type=code&state=${encodeURIComponent(
        JSON.stringify(loginState),
      )}`;
      this.navigation.assign(url);
    } else {
      window.open(url, '_blank');
    }
  }

  newNonce(length: number): string {
    let result = '';
    const characters =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
      counter += 1;
    }
    return result;
  }
}
