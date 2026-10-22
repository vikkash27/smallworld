/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as crons from "../crons.js";
import type * as platform_errors from "../platform_errors.js";
import type * as platform_model from "../platform_model.js";
import type * as platform_mutations from "../platform_mutations.js";
import type * as platform_queries from "../platform_queries.js";
import type * as platform_store from "../platform_store.js";
import type * as platform_validation from "../platform_validation.js";
import type * as seed from "../seed.js";
import type * as whatsapp_contracts from "../whatsapp/contracts.js";
import type * as whatsapp_functions from "../whatsapp/functions.js";
import type * as whatsapp_model from "../whatsapp/model.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  crons: typeof crons;
  platform_errors: typeof platform_errors;
  platform_model: typeof platform_model;
  platform_mutations: typeof platform_mutations;
  platform_queries: typeof platform_queries;
  platform_store: typeof platform_store;
  platform_validation: typeof platform_validation;
  seed: typeof seed;
  "whatsapp/contracts": typeof whatsapp_contracts;
  "whatsapp/functions": typeof whatsapp_functions;
  "whatsapp/model": typeof whatsapp_model;
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
