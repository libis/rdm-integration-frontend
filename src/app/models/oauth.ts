// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

export interface LoginState {
  sourceUrl?: string;
  url?: string;
  pluginId?: Item;
  repoName?: string;
  user?: string;
  nounce?: string;
  code?: string;
  option?: Item;
  datasetId?: Item;
  collectionId?: Item;
}

export interface Item {
  label?: string;
  value?: string;
}

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  refresh_token_expires_in: number;
  scope: string;
  token_type: string;
  error: string;
  error_description: string;
  error_uri: string;
}