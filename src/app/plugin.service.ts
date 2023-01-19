import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { SelectItem } from 'primeng/api';
import { Config, RepoPlugin } from './models/plugin';

@Injectable({
  providedIn: 'root'
})
export class PluginService {

  private config: Config = {
    dataverseHeader: "Unknown header: configuration failed",
    collectionOptionsHidden: true,
    createNewDatasetEnabled: false,
    datasetFieldEditable: false,
    plugins: [],
  };

  private pluginIds: SelectItem<string>[] = [];

  private allPlugins: Map<string, RepoPlugin> = new Map<string, RepoPlugin>();

  private defaultPlugin: RepoPlugin = {
    id: 'defaultPlugin',
    name: "Unknown repository type",
    sourceUrlFieldName: "Source URL",
    sourceUrlFieldPlaceholder: "URL",
    parseSourceUrlField: false,
  };

  constructor(private http: HttpClient) {
    this.setConfig();
  }

  private setConfig(): void {
    let subscr = this.http.get<Config>(`/api/frontend/config`).subscribe(
      c => {
        this.config = c;
        this.config.plugins.forEach(p => {
          this.allPlugins.set(p.id, p);
          this.pluginIds.push({ label: p.name, value: p.id });
          subscr.unsubscribe();
        });
      }
    );
  }

  getRepoTypes(): SelectItem<string>[] {
    return this.pluginIds
  }

  getPlugin(p?: string): RepoPlugin {
    var plugin: RepoPlugin | undefined;
    if (p !== undefined) {
      plugin = this.allPlugins.get(p);
    }
    if (plugin) {
      return plugin;
    }
    return this.defaultPlugin
  }

  getToken(p?: string): (string | null) {
    let tokenName = this.getPlugin(p).tokenName
    if (tokenName) {
      return localStorage.getItem(tokenName)
    } else {
      return null
    }
  }

  setToken(p?: string, token?: string) {
    let tokenName = this.getPlugin(p).tokenName
    if (token && tokenName) localStorage.setItem(tokenName, token);
  }

  dataverseHeader(): string {
    return this.config!.dataverseHeader;
  }

  collectionOptionsHidden(): boolean {
    return this.config!.collectionOptionsHidden;
  }

  createNewDatasetEnabled(): boolean {
    return this.config!.createNewDatasetEnabled;
  }

  datasetFieldEditable(): boolean {
    return this.config!.datasetFieldEditable;
  }
}
