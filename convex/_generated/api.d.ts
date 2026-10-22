/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as platform_errors from "../platform_errors.js";
import type * as platform_model from "../platform_model.js";
import type * as platform_mutations from "../platform_mutations.js";
import type * as platform_queries from "../platform_queries.js";
import type * as platform_store from "../platform_store.js";
import type * as platform_validation from "../platform_validation.js";
import type * as seed from "../seed.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  platform_errors: typeof platform_errors;
  platform_model: typeof platform_model;
  platform_mutations: typeof platform_mutations;
  platform_queries: typeof platform_queries;
  platform_store: typeof platform_store;
  platform_validation: typeof platform_validation;
  seed: typeof seed;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
