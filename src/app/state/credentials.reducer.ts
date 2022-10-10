import { createReducer, on } from '@ngrx/store';

import { credentials } from './credentials.actions';
import { Credentials } from '../models/credentials';

export const initialState: Credentials = {};

export const credentialsReducer = createReducer(
  initialState,
  on(credentials, (state, { creds }) => state = creds)
);
