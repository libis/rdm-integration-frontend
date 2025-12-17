// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

export interface RepoPlugin {
  id: string;
  name: string;
  plugin: string;
  pluginName: string;
  optionFieldName?: string;
  optionFieldPlaceholder?: string;
  optionFieldInteractive?: boolean;
  tokenFieldName?: string;
  tokenFieldPlaceholder?: string;
  sourceUrlFieldName?: string;
  sourceUrlFieldPlaceholder?: string;
  sourceUrlFieldValue?: string;
  usernameFieldName?: string;
  usernameFieldPlaceholder?: string;
  repoNameFieldName?: string;
  repoNameFieldPlaceholder?: string;
  repoNameFieldEditable?: boolean;
  repoNameFieldValues?: string[];
  repoNameFieldHasSearch: boolean;
  repoNameFieldHasInit: boolean;
  parseSourceUrlField: boolean;
  tokenName?: string;
  tokenGetter?: TokenGetter;
  showTokenGetter?: boolean;
}

interface TokenGetter {
  URL?: string;
  oauth_client_id?: string;
}

export interface Config {
  dataverseHeader: string;
  collectionOptionsHidden: boolean;
  createNewDatasetEnabled: boolean;
  datasetFieldEditable: boolean;
  collectionFieldEditable: boolean;
  externalURL: string;
  showDvTokenGetter: boolean;
  showDvToken: boolean;
  redirect_uri: string;
  storeDvToken?: boolean;
  sendMails: boolean;
  plugins: RepoPlugin[];
  queues?: Queue[];
  loginRedirectUrl?: string;
  globusGuestDownloadEnabled?: boolean;
}

interface Queue {
  label: string;
  value: string;
  fileExtensions: string[];
}
