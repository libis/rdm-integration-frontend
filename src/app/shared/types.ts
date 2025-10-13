// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { Filestatus } from '../models/datafile';

/**
 * Common interfaces and types used across the application
 */

/**
 * Interface for filter items in the compare component
 */
export interface FilterItem {
  label: string;
  icon: string;
  iconStyle: { color: string };
  title: string;
  fileStatus: Filestatus;
}

/**
 * Base interface for components that manage subscriptions
 */
export interface SubscriptionManager {
  ngOnDestroy(): void;
}
