export interface RepoPlugin {
    id: string;
    name: string;
    optionFieldName: string;
    tokenFieldName: string;
    sourceUrlFieldPlaceholder: string;
    tokenFieldPlaceholder: string;
    usernameFieldHidden: boolean;
    zoneFieldHidden: boolean;
    parseSourceUrlField: boolean;
    tokenName?: string;
}

export interface Config {
    dataverseHeader: string;
    collectionOptionsHidden: boolean;
    plugins: RepoPlugin[];
}