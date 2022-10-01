export enum Filestatus {
  Equal = 0,
  New = 1,
  Updated = 2,
  Deleted = 3
}

export enum Fileaction {
  Ignore = 0,
  Copy = 1,
  Update = 2,
  Delete = 3
}

export interface Datafile {
  path?: string;
  name?: string;
  status?: Filestatus;
  action?: Fileaction;
  hidden?: boolean;
}
