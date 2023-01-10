export interface RepoPlugin {
    name: string;
    optionFieldName: string;
    tokenFieldName: string;
    sourceUrlFieldPlaceholder: string;
    tokenFieldPlaceholder: string;
    usernameFieldHidden: boolean;
    zoneFieldHidden: boolean;
    parseSourceUrlField: boolean;
    getToken(): string | null;
    setToken(token: string | undefined): void;
}