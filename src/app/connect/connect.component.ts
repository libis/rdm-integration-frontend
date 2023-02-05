/* eslint-disable @typescript-eslint/no-non-null-assertion */
// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Credentials } from '../models/credentials';
import { DataStateService } from '../data.state.service';
import { DatasetService } from '../dataset.service';
import { DvObjectLookupService } from '../dvobject.lookup.service';
import { RepoLookupService } from '../repo.lookup.service';
import { NewDatasetResponse } from '../models/new-dataset-response';
import { SelectItem } from 'primeng/api';
import { DomSanitizer, SafeStyle } from "@angular/platform-browser";
import { PluginService } from '../plugin.service';
import { ActivatedRoute } from '@angular/router';
import { Item, LoginState } from '../models/oauth';
import { OauthService } from '../oauth.service';
import { Dropdown } from 'primeng/dropdown';
import { debounceTime, map, merge, mergeMap, Observable, Subject, Subscription } from 'rxjs';
import { RepoLookupRequest } from '../models/repo-lookup';

@Component({
  selector: 'app-connect',
  templateUrl: './connect.component.html',
  styleUrls: ['./connect.component.scss']
})
export class ConnectComponent implements OnInit {

  @ViewChild('repoDropdown') repoNameDropdown!: Dropdown;

  // CONSTANTS

  DEBOUNCE_TIME = 750;
  DOI_DROPDOWN_WIDTH: SafeStyle = this.sanitizer.bypassSecurityTrustStyle("calc(100% - 12rem)");

  // NG MODEL FIELDS

  plugin?: string;
  pluginId?: string;
  user?: string;
  token?: string;
  sourceUrl?: string;
  repoName?: string;
  selectedRepoName?: string;
  foundRepoName?: string;
  option?: string;
  dataverseToken?: string;
  collectionId?: string;
  datasetId?: string;

  // ITEMS IN DROPDOWNS

  loadingItem: SelectItem<string> = { label: `Loading...`, value: 'loading' }
  loadingItems: SelectItem<string>[] = [this.loadingItem];
  plugins: SelectItem<string>[] = [];
  pluginIds: SelectItem<string>[] = [];
  repoNames: SelectItem<string>[] = [];
  branchItems: SelectItem<string>[] = [];
  collectionItems: SelectItem<string>[] = [];
  doiItems: SelectItem<string>[] = [];

  // INTERNAL STATE VARIABLES

  url?: string;
  pluginIdSelectHidden = true;
  creatingNewDataset = false;
  repoSearchSubject: Subject<string> = new Subject();
  searchResultsObservable: Observable<SelectItem<string>[]>;
  searchResultsSubscription?: Subscription;

  constructor(
    private router: Router,
    private dataStateService: DataStateService,
    private datasetService: DatasetService,
    private sanitizer: DomSanitizer,
    private dvObjectLookupService: DvObjectLookupService,
    private repoLookupService: RepoLookupService,
    private pluginService: PluginService,
    private route: ActivatedRoute,
    private oauth: OauthService,
  ) {
    this.searchResultsObservable = this.repoSearchSubject.pipe<string, Observable<SelectItem<string>[]>>(
      debounceTime(this.DEBOUNCE_TIME),
      map(searchText => this.repoNameSearch(searchText)),
    ).pipe(mergeMap(x => merge(x)));
  }

  ngOnInit(): void {
    const dvToken = localStorage.getItem("dataverseToken");
    if (dvToken !== null) {
      this.dataverseToken = dvToken;
    }
    this.searchResultsObservable.subscribe({
      next: (x) => this.repoNames = x,
      error: (err) => this.repoNames = [{ value: err.toString() }],
    });
    this.route.queryParams
      .subscribe(params => {
        const stateString = params['state'];
        if (stateString === undefined || stateString === null || stateString === '') {
          return;
        }
        const loginState: LoginState = JSON.parse(params['state']);
        this.sourceUrl = loginState.sourceUrl;
        this.url = loginState.url;
        this.repoName = loginState.repoName;
        this.selectedRepoName = loginState.repoName;
        this.foundRepoName = loginState.repoName;
        this.user = loginState.user;

        if (loginState.plugin !== undefined && loginState.plugin.value !== undefined) {
          this.plugins = [{ label: loginState.plugin.label, value: loginState.plugin.value! }];
          this.plugin = loginState.plugin.value;
        }

        if (loginState.pluginId !== undefined && loginState.pluginId.value !== undefined) {
          this.pluginIds = [{ label: loginState.pluginId.label, value: loginState.pluginId.value! }];
          this.pluginId = loginState.pluginId.value;
          this.pluginIdSelectHidden = loginState.pluginId.hidden!;
        } else {
          this.pluginIdSelectHidden = true;
        }

        if (loginState.option !== undefined && loginState.option.value !== undefined) {
          this.branchItems = [{ label: loginState.option.label, value: loginState.option.value! }, this.loadingItem];
          this.option = loginState.option?.value;
        }

        if (loginState.datasetId !== undefined && loginState.datasetId.value !== undefined) {
          this.doiItems = [{ label: loginState.datasetId.label, value: loginState.datasetId.value! }, this.loadingItem];
          this.datasetId = loginState.datasetId?.value;
        }

        if (loginState.collectionId !== undefined && loginState.collectionId.value !== undefined) {
          this.collectionItems = [{ label: loginState.collectionId.label, value: loginState.collectionId.value! }, this.loadingItem];
          this.collectionId = loginState.collectionId?.value;
        }

        const code = params['code'];
        if (this.getNounce() === loginState.nounce && this.pluginId !== undefined && code !== undefined) {
          const tokenSubscr = this.oauth.getToken(this.pluginId, code, loginState.nounce).subscribe(x => {
            this.token = x.access_token;
            if (!this.pluginService.isStoreDvToken()) {
              localStorage.removeItem("dataverseToken");
            }
            tokenSubscr.unsubscribe();
          });
        }
      });
  }

  ngOnDestroy() {
    this.searchResultsSubscription?.unsubscribe();
  }

  /***********************
   * OAUTH AND API TOKEN *
   ***********************/

  hasOauthConfig(): boolean {
    return this.pluginService.getPlugin(this.pluginId).tokenGetter?.oauth_client_id !== undefined;
  }

  isAuthorized(): boolean {
    return this.token !== undefined;
  }

  showRepoTokenGetter(): boolean {
    return this.pluginService.getPlugin(this.pluginId).showTokenGetter!;
  }

  getRepoToken() {
    if (this.pluginId === undefined) {
      alert('Repository type is missing');
      return;
    }
    if (this.dataverseToken !== undefined) {
      localStorage.setItem("dataverseToken", this.dataverseToken!);
    }
    const tg = this.pluginService.getPlugin(this.pluginId).tokenGetter!;
    let url = this.url + (tg.URL === undefined ? '' : tg.URL);
    if (tg.URL?.includes('://')) {
      url = tg.URL;
    }
    if (tg.oauth_client_id !== undefined && tg.oauth_client_id !== '') {
      const nounce = this.newNounce(44);
      const pluginId = this.getItem(this.pluginIds, this.pluginId);
      if (pluginId !== undefined) {
        pluginId.hidden = this.pluginIdSelectHidden;
      }
      const looginState: LoginState = {
        sourceUrl: this.sourceUrl,
        url: this.url,
        plugin: this.getItem(this.plugins, this.plugin),
        pluginId: pluginId,
        repoName: this.getRepoName(),
        user: this.user,
        option: this.getItem(this.branchItems, this.option),
        datasetId: this.getItem(this.doiItems, this.datasetId),
        collectionId: this.getItem(this.collectionItems, this.collectionId),
        nounce: nounce,
      }
      url = url + '?client_id=' + tg.oauth_client_id +
        '&redirect_uri=' + this.pluginService.getRedirectUri() +
        '&response_type=code&state=' + JSON.stringify(looginState);
      // + '&code_challenge=' + nounce + '&code_challenge_method=S256';
      location.href = url;
    } else {
      window.open(url, "_blank");
    }
  }

  newNounce(length: number): string {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
      counter += 1;
    }
    localStorage.setItem("nounce", result);
    return result;
  }

  getNounce(): string | null {
    const result = localStorage.getItem("nounce");
    localStorage.removeItem("nounce");
    return result;
  }

  getItem(items: SelectItem<string>[], value?: string): Item | undefined {
    if (value === undefined) {
      return undefined;
    }
    const label = items.find(x => x.value === value)?.label
    return { label: label, value: value }
  }

  // API TOKEN FIELD

  getTokenFieldName(): string | undefined {
    return this.pluginService.getPlugin(this.pluginId).tokenFieldName;
  }

  getTokenPlaceholder(): string | undefined {
    return this.pluginService.getPlugin(this.pluginId).tokenFieldPlaceholder;
  }

  /***********
   * CONNECT *
   ***********/

  connect() {
    const err = this.parseAndCheckFields();
    if (err !== undefined) {
      alert(err);
      return;
    }
    const tokenName = this.pluginService.getPlugin(this.pluginId).tokenName
    if (this.token !== undefined && tokenName !== undefined && tokenName !== '') {
      localStorage.setItem(tokenName, this.token);
    }
    const creds: Credentials = {
      pluginId: this.pluginId,
      plugin: this.plugin,
      repo_name: this.getRepoName(),
      url: this.url,
      option: this.option,
      user: this.user,
      token: this.token,
      dataset_id: this.datasetId,
      dataverse_token: this.dataverseToken,
    }
    this.dataStateService.initializeState(creds);
    this.router.navigate(['/compare', this.datasetId]);
  }

  parseAndCheckFields(): string | undefined {
    const strings: (string | undefined)[] = [this.pluginId, this.datasetId, this.dataverseToken];
    const names: string[] = ['Repository type', 'Dataset DOI', 'Dataverse token'];
    if (this.getSourceUrlFieldName()) {
      strings.push(this.sourceUrl);
      names.push(this.getSourceUrlFieldName()!);
    }
    if (this.getTokenFieldName()) {
      strings.push(this.token);
      names.push(this.getTokenFieldName()!);
    }
    if (this.getOptionFieldName()) {
      strings.push(this.option);
      names.push(this.getOptionFieldName()!);
    }
    if (this.getUsernameFieldName()) {
      strings.push(this.user);
      names.push(this.getUsernameFieldName()!);
    }
    if (this.getRepoNameFieldName()) {
      strings.push(this.getRepoName());
      names.push(this.getRepoNameFieldName()!);
    }

    let cnt = 0;
    let res = 'One or more mandatory fields are missing:';
    for (let i = 0; i < strings.length; i++) {
      const s = strings[i];
      if (s === undefined || s === '' || s === 'loading') {
        cnt++;
        res = res + '\n- ' + names[i];
      }
    }

    const err = this.parseUrl();
    if (err) {
      cnt++;
      res = res + '\n\n' + err;
    }

    if (cnt === 0) {
      return undefined;
    }
    return res;
  }

  parseUrl(): string | undefined {
    if (!this.pluginService.getPlugin(this.pluginId).parseSourceUrlField) {
      this.url = this.getSourceUrlValue();
      console.log(this.url)
      return;
    }
    let toSplit = this.sourceUrl!;
    if (toSplit.endsWith("/")) {
      toSplit = toSplit.substring(0, toSplit.length - 1);
    }
    let splitted = toSplit.split('://');
    if (splitted?.length == 2) {
      splitted = splitted[1].split('/');
      if (splitted?.length > 2) {
        this.url = 'https://' + splitted[0];
        this.repoName = splitted.slice(1, splitted.length).join('/');
        if (this.repoName.endsWith(".git")) {
          this.repoName = this.repoName.substring(0, this.repoName.length - 4);
        }
      } else {
        return "Malformed source url";
      }
    } else {
      return "Malformed source url";
    }
    return;
  }

  /**********
   * PLUGIN *
   **********/

  getPlugins() {
    this.plugins = this.pluginService.getPlugins();
  }

  changePlugin() {
    const pluginIds = this.pluginService.getPluginIds(this.plugin);
    if (pluginIds.length === 1) {
      this.pluginId = pluginIds[0].value;
    } else {
      this.pluginId = undefined;
    }
    this.pluginIdSelectHidden = pluginIds.length < 2;
    this.changePluginId();
  }

  getPluginIds() {
    this.pluginIds = this.pluginService.getPluginIds(this.plugin);
  }

  changePluginId() {
    this.token = undefined;
    const tokenName = this.pluginService.getPlugin(this.pluginId).tokenName;
    if (tokenName !== undefined && tokenName !== '') {
      const token = localStorage.getItem(tokenName);
      if (token !== null) {
        this.token = token;
      }
    }

    this.sourceUrl = undefined;
    this.branchItems = [];
    this.option = undefined;
    this.url = undefined;
    this.user = undefined;
    this.repoNames = [];
    this.repoName = undefined;
    this.selectedRepoName = undefined;
    this.foundRepoName = undefined;
  }

  /**************
   * REPOSITORY *
   **************/

  // REPO CHOICE: COMMON

  getRepoNameFieldName(): string | undefined {
    return this.pluginService.getPlugin(this.pluginId).repoNameFieldName;
  }

  getRepoNamePlaceholder(): string {
    const v = this.pluginService.getPlugin(this.pluginId).repoNameFieldPlaceholder;
    return v === undefined ? "" : v;
  }

  repoNameFieldEditable(): boolean {
    const v = this.pluginService.getPlugin(this.pluginId).repoNameFieldEditable;
    return v === undefined ? false : v;
  }

  getRepoName(): string | undefined {
    if (this.repoName !== undefined) {
      return this.repoName;
    }
    if (this.selectedRepoName !== undefined) {
      return this.selectedRepoName;
    }
    return this.foundRepoName;
  }

  getRepoLookupRequest(): RepoLookupRequest | undefined {
    if (this.pluginId === undefined) {
      alert('Repository type is missing');
      return;
    }
    const err = this.parseUrl();
    if (err) {
      alert(err);
      return;
    }
    if (this.url === undefined || this.url === '') {
      alert('URL is missing');
      return;
    }
    if (this.getUsernameFieldName() && (this.user === undefined || this.user === '')) {
      alert(this.getUsernameFieldName() + ' is missing');
      return;
    }
    if (this.getRepoNameFieldName() && (this.getRepoName() === undefined || this.getRepoName() === '') && !this.repoNameSearchEnabled()) {
      alert(this.getRepoNameFieldName() + ' is missing');
      return;
    }
    if (this.branchItems.length !== 0 && this.branchItems.find(x => x === this.loadingItem) === undefined) {
      return;
    }

    this.branchItems = this.loadingItems;

    return {
      pluginId: this.pluginId,
      plugin: this.plugin,
      repoName: this.getRepoName(),
      url: this.url,
      user: this.user,
      token: this.token,
    };
  }

  onRepoChange() {
    this.branchItems = [];
    this.option = undefined;
    this.url = undefined;
    if (this.getRepoNameFieldName() === undefined) {
      this.repoName = undefined;
    }
  }

  // REPO VIA SEARCH

  repoNameSearchEnabled(): boolean {
    return this.pluginService.getPlugin(this.pluginId).repoNameFieldHasSearch!;
  }

  repoNameSearch(searchTerm: string): Observable<SelectItem<string>[]> {
    this.repoNames = this.loadingItems;
    const req = this.getRepoLookupRequest();
    if (req === undefined) {
      const subj = new Subject<SelectItem<string>[]>();
      subj.next([]);
      return subj;
    }
    req.repoName = searchTerm;
    return this.repoLookupService.search(req);
  }

  onRepoNameSearch(searchTerm: string | null) {
    if (searchTerm === null || searchTerm.length < 3) {
      this.repoNames = [{ label: 'start typeing to search (at least 3 letters)', value: '' }];
      return;
    }
    this.repoSearchSubject.next(searchTerm);
  }

  startRepoSearch() {
    if (this.foundRepoName !== undefined) {
      return;
    }
    this.repoNames = [{ label: 'start typeing to search (at least 3 letters)', value: '' }];
  }

  // REPO VIA URL

  getSourceUrlFieldName(): string | undefined {
    return this.pluginService.getPlugin(this.pluginId).sourceUrlFieldName;
  }

  getSourceUrlPlaceholder(): string | undefined {
    return this.pluginService.getPlugin(this.pluginId).sourceUrlFieldPlaceholder;
  }

  getSourceUrlValue(): string | undefined {
    const repoName = this.getRepoName();
    const valueMap = this.pluginService.getPlugin(this.pluginId).sourceUrlFieldValueMap;
    if (repoName !== undefined && valueMap !== undefined) {
      const res = valueMap[repoName];
      if (res !== undefined && res !== null) {
        return res;
      }
    }
    const res = this.pluginService.getPlugin(this.pluginId).sourceUrlFieldValue;
    if (res !== undefined) {
      return res;
    }
    return this.sourceUrl;
  }

  // REPO VIA DROPDOWN

  getPluginRepoNames(): SelectItem<string>[] {
    const res: SelectItem<string>[] = [];
    this.pluginService.getPlugin(this.pluginId).repoNameFieldValues?.forEach(x => res.push({ label: x, value: x }));
    return res;
  }

  showRepoName() {
    this.repoNameDropdown.show();
  }

  // BRANCHES/FOLDERS/OTHER OPTIONS

  getOptionFieldName(): string | undefined {
    return this.pluginService.getPlugin(this.pluginId).optionFieldName;
  }

  getOptionPlaceholder(): string {
    const v = this.pluginService.getPlugin(this.pluginId).optionFieldPlaceholder;
    return v === undefined ? "" : v;
  }

  getOptions(): void {
    const req = this.getRepoLookupRequest();
    if (req === undefined) {
      return;
    }

    const httpSubscr = this.repoLookupService.getOptions(req).subscribe({
      next: (items: SelectItem<string>[]) => {
        if (items !== undefined && items.length > 0) {
          this.branchItems = items;
        } else {
          this.branchItems = [];
        }
        httpSubscr.unsubscribe();
      },
      error: (err) => {
        alert("branch lookup failed: " + err.error);
        this.branchItems = [];
        this.option = undefined;
      },
    });
  }

  // USER FIELD

  getUsernameFieldName(): string | undefined {
    return this.pluginService.getPlugin(this.pluginId).usernameFieldName;
  }

  getUsernamePlaceholder(): string | undefined {
    return this.pluginService.getPlugin(this.pluginId).usernameFieldPlaceholder;
  }

  /****************************************
   * DATAVERSE: DATASET CHOICE AND OPTIONS*
   ****************************************/

  dataverseHeader(): string {
    return this.pluginService.dataverseHeader();
  }

  // DATAVERSE API TOKEN

  showDVTokenGetter(): boolean {
    return this.pluginService.showDVTokenGetter();
  }

  getDataverseToken(): void {
    const url = this.pluginService.getExternalURL() + '/dataverseuser.xhtml?selectTab=apiTokenTab';
    window.open(url, "_blank");
  }

  onUserChange() {
    this.doiItems = [];
    this.collectionItems = [];
    this.datasetId = undefined;
    this.collectionId = undefined;
    if (this.dataverseToken !== undefined && this.pluginService.isStoreDvToken()) {
      localStorage.setItem("dataverseToken", this.dataverseToken!);
    }
  }

  // DV OBJECTS: COMMON

  getDvObjectOptions(objectType: string, dvItems: SelectItem<string>[], setter: (comp: ConnectComponent, items: SelectItem<string>[]) => void): void {
    if (this.dataverseToken === undefined || this.dataverseToken === '') {
      alert('Dataverse object lookup failed: Dataverse API token is missing');
      setter(this, []);
      return;
    }
    if (dvItems.length !== 0 && dvItems.find(x => x === this.loadingItem) === undefined) {
      return;
    }
    setter(this, this.loadingItems);

    const httpSubscr = this.dvObjectLookupService.getItems((this.collectionId ? this.collectionId! : ""), objectType, this.dataverseToken).subscribe({
      next: (items: SelectItem<string>[]) => {
        if (items !== undefined && items.length > 0) {
          setter(this, items);
        } else {
          setter(this, []);
        }
        httpSubscr.unsubscribe();
      },
      error: (err) => {
        alert("doi lookup failed: " + err.error);
        setter(this, []);
      },
    });
  }

  // COLLECTIONS

  getCollectionOptions(): void {
    this.getDvObjectOptions("Dataverse", this.collectionItems, this.setCollectionItems)
  }

  setCollectionItems(comp: ConnectComponent, items: SelectItem<string>[]): void {
    comp.collectionItems = items;
    comp.collectionId = undefined;
  }

  collectionOptionsHidden(): boolean {
    return this.pluginService.collectionOptionsHidden();
  }

  collectionFieldEditable(): boolean {
    return this.pluginService.collectionFieldEditable();
  }

  onCollectionChange() {
    this.doiItems = [];
    this.datasetId = undefined;
  }

  // DATASETS

  getDoiOptions(): void {
    this.getDvObjectOptions("Dataset", this.doiItems, this.setDoiItems)
  }

  setDoiItems(comp: ConnectComponent, items: SelectItem<string>[]): void {
    comp.doiItems = items;
    comp.datasetId = undefined;
  }

  datasetFieldEditable(): boolean {
    return this.pluginService.datasetFieldEditable();
  }

  // NEW DATASET 

  createNewDatasetEnabled(): boolean {
    return !this.creatingNewDataset && this.pluginService.createNewDatasetEnabled();
  }

  newDataset() {
    if (this.dataverseToken === undefined) {
      alert("Dataverse API token is missing.");
      return;
    }
    this.creatingNewDataset = true;
    const httpSubscr = this.datasetService.newDataset((this.collectionId ? this.collectionId! : ""), this.dataverseToken).subscribe({
      next: (data: NewDatasetResponse) => {
        this.datasetId = data.persistentId;
        httpSubscr.unsubscribe();
        this.creatingNewDataset = false;
      },
      error: (err) => {
        alert("creating new dataset failed: " + err.error);
        httpSubscr.unsubscribe();
        this.creatingNewDataset = false;
      }
    });
  }
}
