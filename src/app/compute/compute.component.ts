// Author: Eryk Kulikowski @ KU Leuven (2024). Apache 2.0 License

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { Subscription } from 'rxjs';

// Services
import { ActivatedRoute } from '@angular/router';
import { DataService } from '../data.service';
import { DvObjectLookupService } from '../dvobject.lookup.service';
import { PluginService } from '../plugin.service';
import { NavigationService } from '../shared/navigation.service';
import { NotificationService } from '../shared/notification.service';
import { UtilsService } from '../utils.service';

// Models
import {
  CachedComputeResponse,
  CompareResult,
  ComputeRequest,
  Key,
} from '../models/compare-result';
import { Datafile } from '../models/datafile';

// PrimeNG
import { FormsModule } from '@angular/forms';
import { PrimeTemplate, SelectItem, TreeNode } from 'primeng/api';
import { Button, ButtonDirective } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { Dialog } from 'primeng/dialog';
import { FloatLabel } from 'primeng/floatlabel';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { Select } from 'primeng/select';
import { TreeTableModule } from 'primeng/treetable';

// Components
import { ExecutablefileComponent } from '../executablefile/executablefile.component';

// Third-party
import { AutosizeModule } from 'ngx-autosize';

// RxJS
import { debounceTime, firstValueFrom, map, Observable, Subject } from 'rxjs';

// Constants and types
import { APP_CONSTANTS } from '../shared/constants';
import { SubscriptionManager } from '../shared/types';

@Component({
  selector: 'app-compute',
  templateUrl: './compute.component.html',
  styleUrl: './compute.component.scss',
  imports: [
    ButtonDirective,
    FormsModule,
    FloatLabel,
    Select,
    Dialog,
    Checkbox,
    PrimeTemplate,
    Button,
    TreeTableModule,
    ProgressSpinnerModule,
    ExecutablefileComponent,
    AutosizeModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComputeComponent
  implements OnInit, OnDestroy, SubscriptionManager
{
  private readonly dvObjectLookupService = inject(DvObjectLookupService);
  private readonly pluginService = inject(PluginService);
  private readonly dataService = inject(DataService);
  private readonly utils = inject(UtilsService);
  private readonly route = inject(ActivatedRoute);
  private readonly notificationService = inject(NotificationService);
  private readonly navigation = inject(NavigationService);

  // Subscriptions for cleanup
  private readonly subscriptions = new Set<Subscription>();

  // Icon constants
  readonly icon_play = APP_CONSTANTS.ICONS.PLAY;

  // CONSTANTS
  readonly DEBOUNCE_TIME = APP_CONSTANTS.DEBOUNCE_TIME;

  // NG MODEL FIELDS (signals)
  readonly dataverseToken = signal<string | undefined>(undefined);
  readonly datasetId = signal<string | undefined>(undefined);
  readonly output = signal('');
  readonly data = signal<CompareResult>({});
  readonly rootNodeChildren = signal<TreeNode<Datafile>[]>([]);
  readonly rowNodeMap = signal<Map<string, TreeNode<Datafile>>>(
    new Map<string, TreeNode<Datafile>>(),
  );
  readonly loading = signal(false);
  readonly popup = signal(false);
  readonly outputDisabled = signal(true);
  readonly sendEmailOnSuccess = signal(false);

  // ITEMS IN SELECTS
  readonly loadingItem: SelectItem<string> = {
    label: `Loading...`,
    value: 'loading',
  };
  readonly loadingItems: SelectItem<string>[] = [this.loadingItem];
  readonly doiItems = signal<SelectItem<string>[]>([]);

  // INTERNAL STATE VARIABLES
  datasetSearchSubject: Subject<string> = new Subject();
  datasetSearchResultsObservable: Observable<Promise<SelectItem<string>[]>>;
  datasetSearchResultsSubscription?: Subscription;
  req?: ComputeRequest;

  // Computed signals for template bindings
  readonly showDVToken = computed(() => this.pluginService.showDVToken$());
  readonly datasetFieldEditable = computed(() =>
    this.pluginService.datasetFieldEditable$(),
  );
  readonly dataverseHeader = computed(() =>
    this.pluginService.dataverseHeader$(),
  );
  readonly sendMails = computed(() => this.pluginService.sendMails$());
  readonly configLoaded = computed(() => this.pluginService.configLoaded$());

  constructor() {
    this.datasetSearchResultsObservable = this.datasetSearchSubject.pipe(
      debounceTime(this.DEBOUNCE_TIME),
      map((searchText) => this.datasetSearch(searchText)),
    );
  }

  async ngOnInit() {
    // Load dataverseToken from localStorage if storeDvToken is enabled
    if (this.pluginService.isStoreDvToken()) {
      const dvToken = localStorage.getItem('dataverseToken');
      if (dvToken !== null) {
        this.dataverseToken.set(dvToken);
      }
    }

    this.subscriptions.add(
      this.route.queryParams.subscribe((params) => {
        const pid = params['datasetPid'];
        if (pid) {
          this.doiItems.set([{ label: pid, value: pid }]);
          this.datasetId.set(pid);
        }
        const apiToken = params['apiToken'];
        if (apiToken) {
          this.dataverseToken.set(apiToken);
        }
      }),
    );
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
  }

  ngOnDestroy(): void {
    // Clean up all subscriptions
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions.clear();

    // Clean up existing observable subscriptions
    this.datasetSearchResultsSubscription?.unsubscribe();
  }

  back(): void {
    this.navigation.assign('connect');
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
    if (
      this.doiItems().length !== 0 &&
      this.doiItems().find((x) => x === this.loadingItem) === undefined
    ) {
      return;
    }
    this.doiItems.set(this.loadingItems);
    this.datasetId.set(undefined);

    const httpSubscription = this.dvObjectLookupService
      .getItems('', 'Dataset', undefined, this.dataverseToken())
      .subscribe({
        next: (items: SelectItem<string>[]) => {
          if (items && items.length > 0) {
            this.doiItems.set(items);
            this.datasetId.set(undefined);
          } else {
            this.doiItems.set([]);
            this.datasetId.set(undefined);
          }
          httpSubscription?.unsubscribe();
        },
        error: (err) => {
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
      ),
    );
  }

  onDatasetChange() {
    this.loading.set(true);
    this.output.set('');
    this.outputDisabled.set(true);
    const subscription = this.dataService
      .getExecutableFiles(this.datasetId()!, this.dataverseToken())
      .subscribe({
        next: (data) => {
          subscription?.unsubscribe();
          this.setData(data);
        },
        error: (err) => {
          subscription?.unsubscribe();
          this.notificationService.showError(
            `Getting executable files failed: ${err.error}`,
          );
        },
      });
  }

  setData(data: CompareResult): void {
    this.data.set(data);
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
    this.loading.set(false);
  }

  submitCompute(req: ComputeRequest): void {
    this.req = req;
    this.popup.set(true);
  }

  continueSubmit() {
    this.popup.set(false);
    this.loading.set(true);
    this.req!.sendEmailOnSuccess = this.sendEmailOnSuccess();
    let httpSubscription: Subscription;
    // eslint-disable-next-line prefer-const -- split declaration needed to avoid TDZ with synchronous subscribe
    httpSubscription = this.dataService.compute(this.req!).subscribe({
      next: (key: Key) => {
        httpSubscription?.unsubscribe();
        this.getComputeData(key);
      },
      error: (err) => {
        httpSubscription?.unsubscribe();
        this.notificationService.showError(err);
      },
    });
  }

  private getComputeData(key: Key): void {
    let subscription: Subscription;
    // eslint-disable-next-line prefer-const -- split declaration needed to avoid TDZ with synchronous subscribe
    subscription = this.dataService.getCachedComputeData(key).subscribe({
      next: async (res: CachedComputeResponse) => {
        this.subscriptions.delete(subscription);
        subscription?.unsubscribe();
        if (res.ready === true) {
          this.loading.set(false);
          if (res.res) {
            this.output.set(res.res);
          }
          if (res.err && res.err !== '') {
            this.notificationService.showError(res.err);
          } else {
            this.outputDisabled.set(false);
          }
        } else {
          if (res.res) {
            this.output.set(res.res);
          }
          await this.utils.sleep(1000);
          this.getComputeData(key);
        }
      },
      error: (err) => {
        this.subscriptions.delete(subscription);
        subscription?.unsubscribe();
        this.loading.set(false);
        this.notificationService.showError(
          `Getting computation results failed: ${err.error}`,
        );
      },
    });
    this.subscriptions.add(subscription);
  }
}
