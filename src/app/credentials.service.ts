// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { Injectable, signal, computed, Signal } from '@angular/core';
import { Credentials } from './models/credentials';

@Injectable({
  providedIn: 'root',
})
export class CredentialsService {
  // Internal signal holding the credentials state
  private readonly _credentials = signal<Credentials>({});

  // Signal-based public API
  readonly credentials$: Signal<Credentials> = this._credentials.asReadonly();

  // Computed signals for frequently accessed properties
  readonly plugin$ = computed(() => this._credentials().plugin);
  readonly pluginId$ = computed(() => this._credentials().pluginId);
  readonly repoName$ = computed(() => this._credentials().repo_name);
  readonly url$ = computed(() => this._credentials().url);
  readonly option$ = computed(() => this._credentials().option);
  readonly user$ = computed(() => this._credentials().user);
  readonly token$ = computed(() => this._credentials().token);
  readonly datasetId$ = computed(() => this._credentials().dataset_id);
  readonly newlyCreated$ = computed(() => this._credentials().newly_created);
  readonly dataverseToken$ = computed(
    () => this._credentials().dataverse_token,
  );
  readonly metadataAvailable$ = computed(
    () => this._credentials().metadata_available,
  );

  // Methods for updating credentials
  setCredentials(credentials: Credentials): void {
    this._credentials.set(credentials);
  }

  updateCredentials(partial: Partial<Credentials>): void {
    this._credentials.update((current) => ({ ...current, ...partial }));
  }

  clearCredentials(): void {
    this._credentials.set({});
  }
}
