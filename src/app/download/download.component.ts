// Author: Eryk Kulikowski @ KU Leuven (2024). Apache 2.0 License

import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';

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
import { HierarchicalSelectItem } from '../models/hierarchical-select-item';
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
import {
  convertToTreeNodes,
  createPlaceholderRootOptions,
} from '../shared/tree-utils';
import { SubscriptionManager } from '../shared/types';

@Component({
  selector: 'app-download',
  templateUrl: './download.component.html',
  styleUrl: './download.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
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

  // NG MODEL FIELDS (signals)
  dataverseToken = signal<string | undefined>(undefined);
  datasetId = signal<string | undefined>(undefined);
  data = signal<CompareResult | undefined>(undefined);
  rootNodeChildren = signal<TreeNode<Datafile>[]>([]);
  rowNodeMap = signal<Map<string, TreeNode<Datafile>>>(
    new Map<string, TreeNode<Datafile>>(),
  );
  loading = signal(false);

  // Used to trigger view updates when row actions are mutated
  readonly refreshTrigger = signal(0);

  // ITEMS IN SELECTS (signals)
  loadingItem: SelectItem<string> = { label: `Loading...`, value: 'loading' };
  loadingItems: SelectItem<string>[] = [this.loadingItem];
  doiItems = signal<SelectItem<string>[]>([]);

  // INTERNAL STATE VARIABLES
  datasetSearchSubject: Subject<string> = new Subject();
  datasetSearchResultsObservable: Observable<Promise<SelectItem<string>[]>>;
  datasetSearchResultsSubscription?: Subscription;
  queryParamsSubscription?: Subscription;
  downloadRequested = signal(false);
  downloadInProgress = signal(false);
  lastTransferTaskId = signal<string | undefined>(undefined);
  globusMonitorUrl = signal<string | undefined>(undefined);
  statusPollingActive = signal(false);
  done = signal(false);
  datasetUrl = signal('');
  showGuestLoginPopup = signal(false);
  showPreviewUrlInput = signal(false);
  previewUrlInput = signal('');
  // Access mode: 'guest' | 'preview' | 'login' - tracks user's choice for Globus session
  accessMode = signal<'guest' | 'preview' | 'login'>('guest');
  // Track if guest access was denied (e.g., draft dataset or restricted data)
  accessDeniedForGuest = signal(false);

  // globus (signals)
  token = signal<string | undefined>(undefined);
  repoNames = signal<SelectItem<string>[]>([]);
  selectedRepoName = signal<string | undefined>(undefined);
  foundRepoName = signal<string | undefined>(undefined);
  repoSearchSubject: Subject<string> = new Subject();
  repoSearchResultsObservable: Observable<Promise<SelectItem<string>[]>>;
  repoSearchResultsSubscription?: Subscription;
  branchItems = signal<HierarchicalSelectItem<string>[]>([]);
  option = signal<string | undefined>(undefined);
  // Internal storage for tree nodes; use rootOptions() computed for reading
  private readonly _rootOptionsData = signal<TreeNode<string>[]>(
    createPlaceholderRootOptions(),
  );
  // Computed signal that tracks refreshTrigger for change detection
  readonly rootOptions = computed(() => {
    this.refreshTrigger(); // Track refresh trigger to force re-render
    return this._rootOptionsData();
  });
  selectedOption = signal<TreeNode<string> | undefined>(undefined);
  optionsLoading = signal(false);
  globusPlugin = signal<RepoPlugin | undefined>(undefined);
  downloadId = signal<string | undefined>(undefined);
  datasetDbId = signal<string | undefined>(undefined); // Database ID for preview URL users
  // Pre-selected file IDs from Dataverse UI (via downloadId/globusDownloadParameters)
  preSelectedFileIds = signal<Set<string>>(new Set());

  // Computed signals derived from state
  readonly action = computed(() => {
    this.refreshTrigger(); // Track refresh trigger
    const root = this.rowNodeMap().get('');
    if (root) {
      return DownladablefileComponent.actionIconFromNode(root);
    }
    return DownladablefileComponent.icon_ignore;
  });

  readonly downloadDisabled = computed(
    () =>
      this.downloadRequested() ||
      this.downloadInProgress() ||
      this.statusPollingActive() ||
      !this.option() ||
      !Array.from(this.rowNodeMap().values()).some(
        (x) => x.data?.action === Fileaction.Download,
      ),
  );

  readonly repoNameFieldEditable = computed(() => {
    const v = this.globusPlugin()?.repoNameFieldEditable;
    return v === undefined ? false : v;
  });

  readonly repoNamePlaceholder = computed(() => {
    const v = this.globusPlugin()?.repoNameFieldPlaceholder;
    return v === undefined ? '' : v;
  });

  readonly repoNameSearchInitEnabled = computed(
    () => this.globusPlugin()?.repoNameFieldHasInit,
  );

  readonly optionFieldName = computed(
    () => this.globusPlugin()?.optionFieldName,
  );

  readonly repoNameFieldName = computed(
    () => this.globusPlugin()?.repoNameFieldName,
  );

  readonly repoName = computed(() =>
    this.selectedRepoName() ? this.selectedRepoName() : this.foundRepoName(),
  );

  // Computed signals for pluginService data
  readonly showDVToken = computed(() => this.pluginService.showDVToken$());
  readonly datasetFieldEditable = computed(() =>
    this.pluginService.datasetFieldEditable$(),
  );
  readonly externalURL = computed(() => this.pluginService.externalURL$());

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

    // Load dataverseToken from localStorage if storeDvToken is enabled
    if (this.pluginService.isStoreDvToken()) {
      const dvToken = localStorage.getItem('dataverseToken');
      if (dvToken !== null) {
        this.dataverseToken.set(dvToken);
      }
    }

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
          this.showGuestLoginPopup.set(true);
        } else {
          // eslint-disable-next-line no-console
          console.debug(
            '[DownloadComponent] User is logged in, no popup needed',
          );
          // Logged-in users should keep session_required_single_domain
          this.accessMode.set('login');
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[DownloadComponent] getUserInfo error:', err);
        // eslint-disable-next-line no-console
        console.debug(
          '[DownloadComponent] Assuming not logged in, showing popup',
        );
        this.showGuestLoginPopup.set(true);
      }
    } else {
      // eslint-disable-next-line no-console
      console.debug(
        '[DownloadComponent] OAuth callback detected, skipping popup',
      );
    }

    this.queryParamsSubscription = this.route.queryParams.subscribe((params) => {
      // eslint-disable-next-line no-console
      console.debug('[DownloadComponent] Route params received:', params);

      const apiToken = params['apiToken'];
      if (apiToken) {
        this.dataverseToken.set(apiToken);
      }
      const pid = params['datasetPid'];
      if (pid) {
        this.doiItems.set([{ label: pid, value: pid }]);
        this.datasetId.set(pid);
      }
      this.downloadId.set(params['downloadId']);
      // datasetDbId is passed when getDatasetVersion fails (preview URL users)
      if (params['datasetDbId']) {
        this.datasetDbId.set(params['datasetDbId']);
        // eslint-disable-next-line no-console
        console.debug(
          '[DownloadComponent] Got datasetDbId from params:',
          this.datasetDbId(),
        );
      }

      // If we have datasetDbId and downloadId but no DOI, fetch it now
      if (this.datasetDbId() && this.downloadId() && !this.datasetId()) {
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
          this.doiItems.set([{ label: doi, value: doi }]);
          this.datasetId.set(doi);

          // Restore state from OAuth redirect
          if (loginState.downloadId) {
            this.downloadId.set(loginState.downloadId);
          }
          if (loginState.accessMode) {
            this.accessMode.set(loginState.accessMode);
          }
          if (loginState.dataverseToken) {
            this.dataverseToken.set(loginState.dataverseToken);
          }
          if (loginState.preSelectedFileIds) {
            this.preSelectedFileIds.set(new Set(loginState.preSelectedFileIds));
          }

          // eslint-disable-next-line no-console
          console.debug('[DownloadComponent] State after restore:', {
            doi,
            downloadId: this.downloadId(),
            accessMode: this.accessMode(),
            preSelectedFileIds: this.preSelectedFileIds().size,
          });

          // Load files if we have a valid dataset ID (DOI was fetched before OAuth)
          if (doi && doi !== '?' && doi !== 'undefined') {
            this.onDatasetChange();
          }

          const tokenSubscription = this.oauth
            .getToken('globus', code, loginState.nonce)
            .subscribe((x) => {
              this.token.set(x.session_id);

              tokenSubscription?.unsubscribe();
            });
        }
        this.globusPlugin.set(this.pluginService.getGlobusPlugin());
      } else {
        // First arrival - only redirect if user is logged in (popup not shown)
        this.globusPlugin.set(this.pluginService.getGlobusPlugin());
        if (!this.showGuestLoginPopup()) {
          this.getRepoToken();
        }
      }
    });
    this.datasetSearchResultsSubscription =
      this.datasetSearchResultsObservable.subscribe({
        next: (x) =>
          x
            .then((v) => this.doiItems.set(v))
            .catch((err) =>
              this.doiItems.set([
                {
                  label: `search failed: ${err.message}`,
                  value: err.message,
                },
              ]),
            ),
        error: (err) =>
          this.doiItems.set([
            { label: `search failed: ${err.message}`, value: err.message },
          ]),
      });
    this.repoSearchResultsSubscription =
      this.repoSearchResultsObservable.subscribe({
        next: (x) =>
          x
            .then((v) => this.repoNames.set(v))
            .catch((err) =>
              this.repoNames.set([
                {
                  label: `search failed: ${err.message}`,
                  value: err.message,
                },
              ]),
            ),
        error: (err) =>
          this.repoNames.set([
            { label: `search failed: ${err.message}`, value: err.message },
          ]),
      });

    // Auto-load dataset options on init
    this.getDoiOptions();
  }

  ngOnDestroy() {
    this.queryParamsSubscription?.unsubscribe();
    this.datasetSearchResultsSubscription?.unsubscribe();
    this.repoSearchResultsSubscription?.unsubscribe();
  }

  redirectToLogin(): void {
    this.pluginService.redirectToLogin();
  }

  continueAsGuest(): void {
    // User chose to continue as guest - now redirect to Globus OAuth
    this.accessDeniedForGuest.set(false);
    // If still loading DOI, wait for it to complete
    if (this.loading()) {
      // eslint-disable-next-line no-console
      console.debug(
        '[DownloadComponent] Still loading DOI, waiting before redirect',
      );
      const checkInterval = setInterval(() => {
        if (!this.loading()) {
          clearInterval(checkInterval);
          this.accessMode.set('guest');
          this.showGuestLoginPopup.set(false);
          this.getRepoToken();
        }
      }, 100);
      return;
    }
    this.accessMode.set('guest');
    this.showGuestLoginPopup.set(false);
    this.getRepoToken();
  }

  continueWithPreviewUrl(): void {
    // User chose to continue with preview URL - extract token and datasetDbId, then fetch DOI
    // eslint-disable-next-line no-console
    console.debug(
      '[DownloadComponent] continueWithPreviewUrl called. Input:',
      this.previewUrlInput(),
    );
    const parsed = this.extractFromPreviewUrl(this.previewUrlInput());
    // eslint-disable-next-line no-console
    console.debug('[DownloadComponent] Parsed result:', parsed);
    if (!parsed?.token) {
      // eslint-disable-next-line no-console
      console.error('[DownloadComponent] Could not extract token from input');
      return;
    }
    this.dataverseToken.set(parsed.token);
    // eslint-disable-next-line no-console
    console.debug(
      '[DownloadComponent] Token set. this.dataverseToken:',
      this.dataverseToken(),
    );
    if (parsed.datasetDbId) {
      this.datasetDbId.set(parsed.datasetDbId);
    }
    this.accessMode.set('preview');
    this.showGuestLoginPopup.set(false);

    // If we have datasetDbId and downloadId, fetch DOI BEFORE going to OAuth
    if (this.datasetDbId() && this.downloadId()) {
      this.loading.set(true);
      const dataverseUrl = this.externalURL();
      // eslint-disable-next-line no-console
      console.debug(
        '[DownloadComponent] Fetching DOI before OAuth. datasetDbId:',
        this.datasetDbId(),
        'downloadId:',
        this.downloadId(),
      );
      this.dataService
        .getGlobusDownloadParams(
          dataverseUrl,
          this.datasetDbId()!,
          this.downloadId()!,
          this.dataverseToken(),
        )
        .subscribe({
          next: (response) => {
            this.loading.set(false);
            const pid = response.data?.queryParameters?.datasetPid;
            if (pid) {
              // eslint-disable-next-line no-console
              console.debug('[DownloadComponent] Got DOI:', pid);
              this.datasetId.set(pid);
              this.doiItems.set([{ label: pid, value: pid }]);
            }
            // Extract pre-selected file IDs from the files field
            this.extractPreSelectedFileIds(
              response.data?.queryParameters?.files,
            );
            // Now proceed to OAuth with DOI already known
            this.getRepoToken();
          },
          error: (err) => {
            this.loading.set(false);
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
    this.showGuestLoginPopup.set(false);
    this.redirectToLogin();
  }

  /**
   * Fetches the DOI from globusDownloadParameters API using datasetDbId.
   * Called automatically when we have datasetDbId but no DOI.
   * Token is optional - API may work without it for signed URLs.
   */
  private fetchDoiFromGlobusParams(): void {
    if (!this.datasetDbId() || !this.downloadId()) {
      return;
    }
    this.loading.set(true);
    const dataverseUrl = this.externalURL();
    // eslint-disable-next-line no-console
    console.debug(
      '[DownloadComponent] Fetching DOI. datasetDbId:',
      this.datasetDbId(),
      'downloadId:',
      this.downloadId(),
    );
    this.dataService
      .getGlobusDownloadParams(
        dataverseUrl,
        this.datasetDbId()!,
        this.downloadId()!,
        this.dataverseToken(),
      )
      .subscribe({
        next: (response) => {
          this.loading.set(false);
          const pid = response.data?.queryParameters?.datasetPid;
          if (pid) {
            // eslint-disable-next-line no-console
            console.debug('[DownloadComponent] Got DOI:', pid);
            this.datasetId.set(pid);
            this.doiItems.set([{ label: pid, value: pid }]);
            // Extract pre-selected file IDs from the files field
            this.extractPreSelectedFileIds(
              response.data?.queryParameters?.files,
            );
            // Now that we have DOI, proceed to OAuth if popup not shown
            if (!this.showGuestLoginPopup()) {
              this.getRepoToken();
            }
          }
        },
        error: (err) => {
          this.loading.set(false);
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
    this.doiItems.set([]);
    this.datasetId.set(undefined);
    // Save dataverseToken to localStorage if storeDvToken is enabled
    if (
      this.dataverseToken() !== undefined &&
      this.pluginService.isStoreDvToken()
    ) {
      localStorage.setItem('dataverseToken', this.dataverseToken()!);
    }
  }

  // DV OBJECTS: COMMON
  getDoiOptions(): void {
    // Don't reload if we already have valid options (not just '?' or loading)
    if (
      this.doiItems().length !== 0 &&
      this.doiItems().find((x) => x === this.loadingItem) === undefined &&
      this.datasetId() !== '?'
    ) {
      return;
    }
    // Don't reload if we're currently fetching DOI from globusDownloadParameters
    if (this.loading()) {
      return;
    }
    // Don't reload if we already have a valid datasetId
    if (
      this.datasetId() &&
      this.datasetId() !== '?' &&
      this.datasetId() !== 'undefined'
    ) {
      return;
    }
    this.doiItems.set(this.loadingItems);
    this.datasetId.set(undefined);

    const httpSubscription = this.dvObjectLookupService
      .getItems('', 'Dataset', undefined, this.dataverseToken(), true)
      .subscribe({
        next: (items: SelectItem<string>[]) => {
          httpSubscription?.unsubscribe();
          // Don't overwrite if a valid DOI was set while we were loading
          if (
            this.datasetId() &&
            this.datasetId() !== '?' &&
            this.datasetId() !== 'undefined'
          ) {
            return;
          }
          if (items && items.length > 0) {
            this.doiItems.set(items);
            this.datasetId.set(undefined);
          } else {
            this.doiItems.set([]);
            this.datasetId.set(undefined);
          }
        },
        error: (err) => {
          httpSubscription?.unsubscribe();
          // Don't show error if a valid DOI was set while we were loading
          if (
            this.datasetId() &&
            this.datasetId() !== '?' &&
            this.datasetId() !== 'undefined'
          ) {
            return;
          }
          this.notificationService.showError(`DOI lookup failed: ${err.error}`);
          this.doiItems.set([]);
          this.datasetId.set(undefined);
        },
      });
  }

  onDatasetSearch(searchTerm: string | null) {
    if (searchTerm === null || searchTerm.length < 3) {
      this.doiItems.set([
        {
          label: 'start typing to search (at least three letters)',
          value: 'start',
        },
      ]);
      return;
    }
    this.doiItems.set([
      { label: `searching "${searchTerm}"...`, value: searchTerm },
    ]);
    this.datasetSearchSubject.next(searchTerm);
  }

  async datasetSearch(searchTerm: string): Promise<SelectItem<string>[]> {
    return await firstValueFrom(
      this.dvObjectLookupService.getItems(
        '',
        'Dataset',
        searchTerm,
        this.dataverseToken(),
        true,
      ),
    );
  }

  onDatasetChange() {
    this.loading.set(true);
    let subscription: Subscription;
    subscription = this.dataService
      .getDownloadableFiles(this.datasetId()!, this.dataverseToken())
      .subscribe({
        next: (data) => {
          subscription?.unsubscribe();
          data.data = data.data?.sort((o1, o2) =>
            (o1.id === undefined ? '' : o1.id) <
            (o2.id === undefined ? '' : o2.id)
              ? -1
              : 1,
          );
          this.setData(data);
        },
        error: (err) => {
          subscription?.unsubscribe();
          this.loading.set(false);
          // Check if this is an anonymized preview URL case
          if (this.accessMode() === 'preview' && this.dataverseToken()) {
            this.notificationService.showError(
              'Anonymous Preview URLs are not supported for Globus downloads. ' +
                'Please ask the dataset owner to create a General Preview URL instead. ' +
                'Anonymous Preview URLs (for blind peer review) are restricted by Dataverse ' +
                'and cannot access the Globus file transfer APIs.',
            );
          } else if (this.accessMode() === 'guest') {
            // Guest access was denied - show preview URL option
            this.accessDeniedForGuest.set(true);
            this.showGuestLoginPopup.set(true);
            this.showPreviewUrlInput.set(true);
          } else {
            this.notificationService.showError(
              `Getting downloadable files failed: ${err.error}`,
            );
          }
        },
      });
  }

  setData(data: CompareResult): void {
    this.data.set(data);
    this.datasetUrl.set(data.url || '');
    if (!data.data || data.data.length === 0) {
      this.loading.set(false);
      return;
    }
    const rowDataMap = this.utils.mapDatafiles(data.data);
    rowDataMap.forEach((v) => this.utils.addChild(v, rowDataMap));
    const rootNode = rowDataMap.get('');
    this.rowNodeMap.set(rowDataMap);
    if (rootNode?.children) {
      this.rootNodeChildren.set(rootNode.children);
    }

    // Apply pre-selection from downloadId if available
    if (this.preSelectedFileIds().size > 0) {
      this.applyPreSelection(rowDataMap);
    }

    this.loading.set(false);
  }

  /**
   * Extract pre-selected file IDs from the files field of globusDownloadParameters response.
   * The files field is a Record<string, string> where keys are file IDs.
   */
  private extractPreSelectedFileIds(
    files: Record<string, string> | undefined,
  ): void {
    if (files && typeof files === 'object') {
      const fileIds = Object.keys(files);
      if (fileIds.length > 0) {
        this.preSelectedFileIds.set(new Set(fileIds));
        // eslint-disable-next-line no-console
        console.debug(
          `[DownloadComponent] Extracted ${fileIds.length} pre-selected file ID(s) from Dataverse:`,
          fileIds,
        );
      }
    }
  }

  /**
   * Apply pre-selection to files based on preSelectedFileIds.
   * This honors the user's file selection from Dataverse UI.
   */
  private applyPreSelection(rowDataMap: Map<string, TreeNode<Datafile>>): void {
    let preSelectedCount = 0;
    rowDataMap.forEach((node) => {
      const fileId = node.data?.attributes?.destinationFile?.id;
      if (
        fileId !== undefined &&
        this.preSelectedFileIds().has(String(fileId))
      ) {
        node.data!.action = Fileaction.Download;
        preSelectedCount++;
      }
    });

    // Update folder actions to reflect child selections
    if (preSelectedCount > 0) {
      const rootNode = rowDataMap.get('');
      if (rootNode) {
        this.updateFolderActionsRecursive(rootNode);
      }
      // eslint-disable-next-line no-console
      console.debug(
        `[DownloadComponent] Pre-selected ${preSelectedCount} file(s) from Dataverse UI`,
      );
    }
  }

  /**
   * Recursively update folder actions based on child file actions.
   */
  private updateFolderActionsRecursive(node: TreeNode<Datafile>): Fileaction {
    if (node.children && node.children.length > 0) {
      let result: Fileaction | undefined = undefined;
      for (const child of node.children) {
        const childAction = this.updateFolderActionsRecursive(child);
        if (result !== undefined && result !== childAction) {
          result = Fileaction.Custom;
        } else if (result === undefined) {
          result = childAction;
        }
      }
      if (node.data) {
        node.data.action = result;
      }
      return result ?? Fileaction.Ignore;
    } else {
      return node.data?.action ?? Fileaction.Ignore;
    }
  }

  toggleAction(): void {
    const root = this.rowNodeMap().get('');
    if (root) {
      DownladablefileComponent.toggleNodeAction(root);
    }
    this.refreshTrigger.update((n) => n + 1);
  }

  /** Called by child rows when their action changes */
  onRowActionChanged(): void {
    this.refreshTrigger.update((n) => n + 1);
  }

  async download(): Promise<void> {
    const selected: Datafile[] = [];
    this.rowNodeMap().forEach((datafile) => {
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

    this.downloadRequested.set(true);
    this.downloadInProgress.set(true);
    this.lastTransferTaskId.set(undefined);
    this.globusMonitorUrl.set(undefined);
    this.statusPollingActive.set(false);

    this.submit
      .download(
        selected,
        this.repoName(),
        this.option(),
        this.token(),
        this.datasetId(),
        this.dataverseToken(),
        this.downloadId(),
      )
      .subscribe({
        next: (response) => {
          this.downloadRequested.set(false);
          this.downloadInProgress.set(false);

          const taskId = response?.taskId ?? '';
          if (!taskId) {
            this.notificationService.showSuccess('Download request submitted.');
            return;
          }

          this.lastTransferTaskId.set(taskId);
          this.globusMonitorUrl.set(
            response.monitorUrl ?? this.buildGlobusMonitorUrl(taskId),
          );
          this.notificationService.showSuccess(
            `Download request started. Globus task ID: ${taskId}`,
          );
        },
        error: (err: unknown) => {
          this.downloadRequested.set(false);
          this.downloadInProgress.set(false);
          this.statusPollingActive.set(false);

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
    this.statusPollingActive.set(active);
  }

  goToDataset(): void {
    if (this.datasetUrl()) {
      window.open(this.datasetUrl(), '_blank');
    }
  }

  private buildGlobusMonitorUrl(taskId: string): string {
    if (!taskId) {
      return '';
    }
    return `https://app.globus.org/activity/${encodeURIComponent(taskId)}`;
  }

  // globus
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
      this.repoNameFieldName() &&
      (this.repoName() === undefined || this.repoName() === '') &&
      !isSearch
    ) {
      this.notificationService.showError(
        `${this.repoNameFieldName()} is missing`,
      );
      return;
    }
    if (
      this.branchItems().length !== 0 &&
      this.branchItems().find((x) => x === this.loadingItem) === undefined
    ) {
      return;
    }
    this.branchItems.set(this.loadingItems);

    return {
      pluginId: 'globus',
      plugin: 'globus',
      repoName: this.repoName(),
      url: this.globusPlugin()?.sourceUrlFieldValue,
      token: this.token(),
    };
  }

  onRepoNameSearch(searchTerm: string | null) {
    if (searchTerm === null || searchTerm.length < 3) {
      this.repoNames.set([
        {
          label: 'start typing to search (at least three letters)',
          value: 'start',
        },
      ]);
      return;
    }
    this.repoNames.set([
      { label: `searching "${searchTerm}"...`, value: searchTerm },
    ]);
    this.repoSearchSubject.next(searchTerm);
  }

  startRepoSearch() {
    if (this.foundRepoName() !== undefined) {
      return;
    }
    if (this.repoNameSearchInitEnabled()) {
      this.repoNames.set([{ label: 'loading...', value: 'start' }]);
      this.repoSearchSubject.next('');
    } else {
      this.repoNames.set([
        {
          label: 'start typing to search (at least three letters)',
          value: 'start',
        },
      ]);
    }
  }

  getOptions(node?: TreeNode<string>): void {
    const req = this.getRepoLookupRequest(false);
    if (req === undefined) {
      return;
    }
    if (node) {
      req.option = node.data;
      this.optionsLoading.set(true);
    }

    let httpSubscription: Subscription;
    httpSubscription = this.repoLookupService.getOptions(req).subscribe({
      next: (items: HierarchicalSelectItem<string>[]) => {
        this.handleOptionsResponse(items, node);
        httpSubscription?.unsubscribe();
      },
      error: (err) => {
        this.notificationService.showError(
          `Branch lookup failed: ${err.error}`,
        );
        this.branchItems.set([]);
        this.option.set(undefined);
        this.optionsLoading.set(false);
      },
    });
  }

  /**
   * Handle response from options lookup API.
   * Builds tree from items and auto-selects if backend marked a node.
   */
  private handleOptionsResponse(
    items: HierarchicalSelectItem<string>[],
    node?: TreeNode<string>,
  ): void {
    if (items && node) {
      // Expanding an existing node - add children
      const nodes = convertToTreeNodes(items);
      node.children = nodes.treeNodes;
      // Increment refresh trigger to force change detection (zoneless Angular)
      this.refreshTrigger.update((n) => n + 1);
      this.optionsLoading.set(false);
      this.autoSelectNode(nodes.selectedNode);
    } else if (items && items.length > 0) {
      // Initial load - convert items directly (backend returns from appropriate starting point)
      const nodes = convertToTreeNodes(items);
      this._rootOptionsData.set(nodes.treeNodes);
      this.branchItems.set(items);
      this.autoSelectNode(nodes.selectedNode);
    } else {
      this.branchItems.set([]);
    }
  }

  /**
   * Auto-select node if backend marked it as selected.
   */
  private autoSelectNode(selectedNode?: TreeNode<string>): void {
    if (selectedNode) {
      this.option.set(selectedNode.data);
      this.selectedOption.set(selectedNode);
    }
  }

  optionSelected(node: TreeNode<string>): void {
    const v = node.data;
    if (v === undefined || v === null) {
      this.selectedOption.set(undefined);
      this.option.set(undefined);
    } else {
      // Allow selecting root "/" or any other folder
      this.option.set(v);
      this.selectedOption.set(node);
    }
  }

  onRepoChange() {
    this.branchItems.set([]);
    this.option.set(undefined);
  }

  getRepoToken() {
    const tg = this.globusPlugin()?.tokenGetter;
    if (tg === undefined) {
      return;
    }
    let url =
      this.globusPlugin()?.sourceUrlFieldValue +
      (tg.URL === undefined ? '' : tg.URL);
    if (tg.URL?.includes('://')) {
      url = tg.URL;
    }
    // For guest/preview users, strip session_required_single_domain to allow any Globus identity
    if (this.accessMode() === 'guest' || this.accessMode() === 'preview') {
      url = url.replace(/[&?]session_required_single_domain=[^&]*/g, '');
    }
    if (tg.oauth_client_id !== undefined && tg.oauth_client_id !== '') {
      const nonce = this.newNonce(44);
      // Include all state to preserve across OAuth redirect
      // eslint-disable-next-line no-console
      console.debug(
        '[DownloadComponent] getRepoToken called. this.dataverseToken:',
        this.dataverseToken(),
        'this.accessMode:',
        this.accessMode(),
      );
      const loginState: LoginState = {
        datasetId:
          this.datasetId() && this.datasetId() !== '?'
            ? { value: this.datasetId()!, label: this.datasetId()! }
            : undefined,
        nonce: nonce,
        download: true,
        downloadId: this.downloadId(),
        accessMode: this.accessMode(),
        dataverseToken: this.dataverseToken(),
        preSelectedFileIds:
          this.preSelectedFileIds().size > 0
            ? Array.from(this.preSelectedFileIds())
            : undefined,
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
