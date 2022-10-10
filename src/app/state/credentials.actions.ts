import { createAction, props } from '@ngrx/store';
import { Credentials } from '../models/credentials';


export const credentials = createAction(
  '[Credentials Component] Credentials',
  props<{ creds: Credentials }>()
);
