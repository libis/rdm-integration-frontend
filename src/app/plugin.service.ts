import { Injectable } from '@angular/core';
import { SelectItem } from 'primeng/api';
import { RepoPlugin } from './models/plugin';

@Injectable({
  providedIn: 'root'
})
export class PluginService {

  private allPlugins: Map<string, RepoPlugin> = new Map<string, RepoPlugin>([
    ["github", {
      id: 'github',
      name: "GitHub",
      optionFieldName: "Branch",
      tokenFieldName: "Token",
      sourceUrlFieldPlaceholder: "https://github.com/<owner>/<repository>",
      tokenFieldPlaceholder: "Repository API token",
      usernameFieldHidden: true,
      zoneFieldHidden: true,
      parseSourceUrlField: true,
      tokenName: 'ghToken',
    }],
    ["gitlab", {
      id: 'gitlab',
      name: "GitLab",
      optionFieldName: "Branch",
      tokenFieldName: "Token",
      sourceUrlFieldPlaceholder: "https://gitlab.kuleuven.be/<group>/<project>",
      tokenFieldPlaceholder: "Repository API token",
      usernameFieldHidden: true,
      zoneFieldHidden: true,
      parseSourceUrlField: true,
      tokenName: 'glToken',
    }],
    ["irods", {
      id: 'irods',
      name: "IRODS",
      optionFieldName: "Folder",
      tokenFieldName: "Token (IRODS password)",
      sourceUrlFieldPlaceholder: "Hostname",
      tokenFieldPlaceholder: "Password",
      usernameFieldHidden: false,
      zoneFieldHidden: false,
      parseSourceUrlField: false,
      tokenName: undefined,
    }],
  ]);

  private defaultPlugin: RepoPlugin = {
    id: 'defaultPlugin',
    name: "Unknown repository type",
    optionFieldName: "Branch",
    tokenFieldName: "Token",
    sourceUrlFieldPlaceholder: "URL",
    tokenFieldPlaceholder: "Repository API token",
    usernameFieldHidden: true,
    zoneFieldHidden: true,
    parseSourceUrlField: false,
    tokenName: undefined,
  };

  constructor() { }

  getRepoTypes(): SelectItem<string>[] {
    return Array.from(this.allPlugins).map(([k, v]) => ({ label: v.name, value: k }));
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
    return "KU Leuven RDR";
  }

  collectionOptionsHidden(): boolean {
    return true;
  }
}
