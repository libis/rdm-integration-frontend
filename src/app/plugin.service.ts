// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { SelectItem } from 'primeng/api';
import { Config, RepoPlugin } from './models/plugin';
import { firstValueFrom } from 'rxjs';
import { NavigationService } from './shared/navigation.service';

const DEFAULT_CONFIG: Config = {
  dataverseHeader: 'Unknown header: configuration failed',
  collectionOptionsHidden: true,
  createNewDatasetEnabled: false,
  datasetFieldEditable: false,
  collectionFieldEditable: false,
  externalURL: '',
  showDvTokenGetter: false,
  showDvToken: true,
  redirect_uri: '',
  sendMails: false,
  plugins: [],
};

const DEFAULT_PLUGIN: RepoPlugin = {
  id: 'defaultPlugin',
  plugin: 'defaultPlugin',
  name: 'Unknown repository type',
  pluginName: 'Unknown plugin',
  parseSourceUrlField: false,
  repoNameFieldHasSearch: false,
  repoNameFieldHasInit: false,
  showTokenGetter: false,
};

@Injectable({
  providedIn: 'root',
})
export class PluginService {
  private readonly http = inject(HttpClient);
  private readonly navigation = inject(NavigationService);

  // Internal signals for reactive state
  private readonly configSignal = signal<Config>(DEFAULT_CONFIG);
  private readonly pluginsMap = signal<Map<string, RepoPlugin>>(new Map());

  // Computed signals for public access (cleaner reactive API)
  readonly dataverseHeader$ = computed(
    () => this.configSignal().dataverseHeader,
  );
  readonly collectionOptionsHidden$ = computed(
    () => this.configSignal().collectionOptionsHidden,
  );
  readonly createNewDatasetEnabled$ = computed(
    () => this.configSignal().createNewDatasetEnabled,
  );
  readonly datasetFieldEditable$ = computed(
    () => this.configSignal().datasetFieldEditable,
  );
  readonly collectionFieldEditable$ = computed(
    () => this.configSignal().collectionFieldEditable,
  );
  readonly externalURL$ = computed(() => this.configSignal().externalURL);
  readonly showDVTokenGetter$ = computed(
    () => this.configSignal().showDvTokenGetter,
  );
  readonly showDVToken$ = computed(() => this.configSignal().showDvToken);
  readonly storeDvToken$ = computed(
    () => this.configSignal().storeDvToken ?? false,
  );
  readonly redirectUri$ = computed(() => this.configSignal().redirect_uri);
  readonly loginRedirectUrl$ = computed(
    () => this.configSignal().loginRedirectUrl,
  );
  readonly sendMails$ = computed(() => this.configSignal().sendMails);
  readonly globusPlugin$ = computed(() =>
    this.configSignal().plugins.find((p) => p.id === 'globus'),
  );

  async setConfig(): Promise<void> {
    const c = await firstValueFrom(
      this.http.get<Config>(`api/frontend/config`),
    );
    const newMap = new Map<string, RepoPlugin>();
    c.plugins.forEach((p) => {
      p.showTokenGetter =
        p.tokenGetter !== undefined &&
        p.tokenGetter.URL !== undefined &&
        p.tokenGetter.URL !== '';
      newMap.set(p.id, p);
    });
    this.configSignal.set(c);
    this.pluginsMap.set(newMap);
  }

  getGlobusPlugin(): RepoPlugin | undefined {
    return this.globusPlugin$();
  }

  getPlugins(): SelectItem<string>[] {
    const res: SelectItem<string>[] = [];
    const added = new Set<string>();
    this.configSignal().plugins.forEach((x) => {
      if (!added.has(x.plugin)) {
        added.add(x.plugin);
        res.push({ value: x.plugin, label: x.pluginName });
      }
    });
    return res;
  }

  getPluginIds(plugin?: string): SelectItem<string>[] {
    const res: SelectItem<string>[] = [];
    this.configSignal().plugins.forEach((x) => {
      if (x.plugin == plugin) {
        res.push({ value: x.id, label: x.name });
      }
    });
    return res;
  }

  getPlugin(p?: string): RepoPlugin {
    if (p !== undefined) {
      const plugin = this.pluginsMap().get(p);
      if (plugin) return plugin;
    }
    return DEFAULT_PLUGIN;
  }

  dataverseHeader(): string {
    return this.dataverseHeader$();
  }

  collectionOptionsHidden(): boolean {
    return this.collectionOptionsHidden$();
  }

  createNewDatasetEnabled(): boolean {
    return this.createNewDatasetEnabled$();
  }

  datasetFieldEditable(): boolean {
    return this.datasetFieldEditable$();
  }

  collectionFieldEditable(): boolean {
    return this.collectionFieldEditable$();
  }

  getExternalURL(): string {
    return this.externalURL$();
  }

  showDVTokenGetter(): boolean {
    return this.showDVTokenGetter$();
  }

  showDVToken(): boolean {
    return this.showDVToken$();
  }

  isStoreDvToken(): boolean {
    return this.storeDvToken$();
  }

  getRedirectUri(): string {
    return this.redirectUri$();
  }

  getLoginRedirectUrl(): string | undefined {
    return this.loginRedirectUrl$();
  }

  redirectToLogin(): void {
    const loginUrl = this.loginRedirectUrl$();

    if (!loginUrl) {
      return;
    }

    // Build the full return URL including current path and query parameters
    const currentUrl = window.location.href;

    // Parse the login URL to extract base and target parameter
    const loginUrlObj = new URL(loginUrl);
    const targetParam = loginUrlObj.searchParams.get('target');

    if (targetParam) {
      // Replace the hardcoded target with the current URL
      loginUrlObj.searchParams.set('target', currentUrl);
      const finalUrl = loginUrlObj.toString();
      this.navigation.assign(finalUrl);
    } else {
      // Fallback to original URL if no target parameter found
      this.navigation.assign(loginUrl);
    }
  }

  sendMails(): boolean {
    return this.sendMails$();
  }

  getQueues(extension: string): SelectItem<string>[] {
    const queues = this.configSignal().queues;
    return queues
      ? queues
          .filter((queue) => queue.fileExtensions.includes(extension))
          .map((queue) => ({ label: queue.label, value: queue.value }))
      : [];
  }
}
