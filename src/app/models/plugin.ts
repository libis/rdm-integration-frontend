// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

export interface RepoPlugin {
    id: string;
    name: string;
    plugin: string;
    pluginName: string;
    optionFieldName?: string;
    optionFieldPlaceholder?: string;
    tokenFieldName?: string;
    tokenFieldPlaceholder?: string;
    sourceUrlFieldName?: string;
    sourceUrlFieldPlaceholder?: string;
    sourceUrlFieldValue?: string;
    sourceUrlFieldValueMap?: { [repoName: string]: string };
    usernameFieldName?: string;
    usernameFieldPlaceholder?: string;
    repoNameFieldName?: string;
    repoNameFieldPlaceholder?: string;
    repoNameFieldEditable?: boolean;
    repoNameFieldValues?: string[];
    repoNameFieldHasSearch: boolean;
    parseSourceUrlField: boolean;
    tokenName?: string;
    tokenGetter?: TokenGetter;
    showTokenGetter?: boolean;
}

export interface TokenGetter {
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
    redirect_uri: string;
    storeDvToken?: boolean;
    plugins: RepoPlugin[];
}