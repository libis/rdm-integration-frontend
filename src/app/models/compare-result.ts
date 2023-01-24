import { Datafile } from "./datafile";

export enum ResultStatus {
  New = 0,
  Updating = 1,
  Finished = 2
}

export interface CompareResult {
  id?: string;
  status?: ResultStatus;
  data?: Datafile[];
  url?: string;
}

export interface CachedResponse {
  key?: string;
  ready?: boolean;
  res?: CompareResult;
  err?: string;
}

export interface Key {
  key?: string;
}
