/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account from "../account.js";
import type * as accountHelpers from "../accountHelpers.js";
import type * as auth from "../auth.js";
import type * as authHelpers from "../authHelpers.js";
import type * as coding from "../coding.js";
import type * as codingAgent from "../codingAgent.js";
import type * as codingHelpers from "../codingHelpers.js";
import type * as codingSchema from "../codingSchema.js";
import type * as invitationActions from "../invitationActions.js";
import type * as invitations from "../invitations.js";
import type * as llamaExtract from "../llamaExtract.js";
import type * as openaiExtract from "../openaiExtract.js";
import type * as passwordReset from "../passwordReset.js";
import type * as passwordResetHelpers from "../passwordResetHelpers.js";
import type * as patients from "../patients.js";
import type * as processing from "../processing.js";
import type * as processingHelpers from "../processingHelpers.js";
import type * as sessions from "../sessions.js";
import type * as teams from "../teams.js";
import type * as uploads from "../uploads.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  accountHelpers: typeof accountHelpers;
  auth: typeof auth;
  authHelpers: typeof authHelpers;
  coding: typeof coding;
  codingAgent: typeof codingAgent;
  codingHelpers: typeof codingHelpers;
  codingSchema: typeof codingSchema;
  invitationActions: typeof invitationActions;
  invitations: typeof invitations;
  llamaExtract: typeof llamaExtract;
  openaiExtract: typeof openaiExtract;
  passwordReset: typeof passwordReset;
  passwordResetHelpers: typeof passwordResetHelpers;
  patients: typeof patients;
  processing: typeof processing;
  processingHelpers: typeof processingHelpers;
  sessions: typeof sessions;
  teams: typeof teams;
  uploads: typeof uploads;
  users: typeof users;
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
