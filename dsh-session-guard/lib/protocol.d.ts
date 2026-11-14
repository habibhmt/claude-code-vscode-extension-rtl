/**
 * Pure protocol helpers for cross-session messaging. This module deliberately
 * imports no Cordis or Harness runtime package, so its rules are unit-testable
 * under plain Node type stripping.
 * @module dsh-session-messaging/protocol
 */
/** `MessageSourceMap` kind declared by this plugin for relayed session messages. */
export declare const SESSION_MESSAGE_KIND = "session-message";
/** Default bound for one relayed message body, in UTF-16 code units. */
export declare const DEFAULT_MAX_MESSAGE_CHARS = 4000;
/** Default per sender→target rate limit. */
export declare const DEFAULT_MAX_MESSAGES_PER_MINUTE = 12;
/** Fixed sliding window for the rate limiter. */
export declare const RATE_LIMIT_WINDOW_MS = 60000;
/** Maximum declared write scopes per message or consent record. */
export declare const MAX_WRITE_SCOPES = 32;
/** Maximum length of one declared write scope. */
export declare const MAX_WRITE_SCOPE_CHARS = 200;
/** Stable refusal reasons surfaced to callers and tests. */
export type MessagingErrorCode = 'invalid-request' | 'caller-not-top-level' | 'self-send' | 'target-not-live' | 'target-not-top-level' | 'target-not-opted-in' | 'target-paused' | 'cold-delivery-failed' | 'cross-directory' | 'rate-limited' | 'delivery-rejected';
/** Typed refusal that a tool call surfaces as an error result. */
export declare class MessagingError extends Error {
    readonly code: MessagingErrorCode;
    constructor(code: MessagingErrorCode, message: string);
}
/** One request to relay a message to another live session. */
export interface SendRequest {
    readonly targetSessionId: string;
    readonly message: string;
    readonly writeScopes?: readonly string[];
    readonly replyTo?: string;
}
/** One peer whose declared write scope overlaps the sender's declaration. */
export interface ScopeConflict {
    readonly sessionId: string;
    readonly scopes: readonly string[];
}
/** Successful relay receipt. Success means inbox acceptance and flush, not recipient processing. */
export interface SendReceipt {
    readonly accepted: true;
    readonly messageId: string;
    readonly targetSessionId: string;
    readonly targetStatus: 'idle' | 'running';
    /** Advisory overlaps with peers' declared write scopes; empty means none detected. */
    readonly conflicts: readonly ScopeConflict[];
    /** Whether delivery used a live Agent or resumed a persisted session first. */
    readonly delivery: 'live' | 'resumed';
}
/** One same-workspace peer as the model sees it. */
export interface PeerView {
    readonly sessionId: string;
    readonly title?: string;
    readonly status: 'idle' | 'running';
    readonly canReceive: boolean;
    readonly writeScopes: readonly string[];
}
/** Minimal header fields needed to distinguish a top-level session. */
export interface SessionLineageHeader {
    readonly parentSession?: unknown;
    readonly isSeeded?: boolean;
    readonly origin?: string;
    readonly delegationDepth?: number;
}
/**
 * Test whether a session header describes a user-launched top-level session.
 *
 * Only two durable fields mark a session as a delegated subagent child:
 * `origin: 'subagent'` and a non-zero `delegationDepth`. `parentSession` is
 * **not** such a marker: it records fork seed lineage, and dsh writes it both
 * for sidebar forks (no `origin`, depth 0) and for subagent children. Treating
 * it as a subagent signal excluded every user fork from the peer channel, so a
 * forked session could neither list peers nor send or receive.
 *
 * This mirrors the host definition: `ctx.agents.roots()` classifies runtime
 * ownership and states that a resumed fork may still be a root
 * (`packages/core/agent/src/index.ts`), while subagent children are created
 * with `origin: 'subagent'` plus `delegationDepth`
 * (`packages/subagent/subagent/src/child-agent.ts`). The UI hides rows by
 * `origin === 'subagent'` alone, never by lineage.
 * @param header - the durable header fields to classify.
 * @returns true for a user-launched top-level session, including a fork.
 */
export declare function isTopLevelSessionHeader(header: SessionLineageHeader): boolean;
/**
 * Compare two optional working directories after path normalization.
 * @param left - first working directory.
 * @param right - second working directory.
 * @returns true when both are present and resolve to the same path.
 */
export declare function sameDirectory(left: string | undefined, right: string | undefined): boolean;
/**
 * Validate and normalize one relay body.
 * @param text - model-supplied message body.
 * @param maxChars - deployment bound in UTF-16 code units.
 * @returns the trimmed body.
 * @throws {MessagingError} for a non-string, empty, oversized, or NUL-containing body.
 */
export declare function validateMessageText(text: string, maxChars: number): string;
/**
 * Validate and deduplicate advisory write scopes.
 * @param scopes - optional caller-supplied scopes.
 * @returns a frozen, ordered, deduplicated list.
 * @throws {MessagingError} for invalid entries.
 */
export declare function normalizeWriteScopes(scopes: readonly string[] | undefined): readonly string[];
/** Normalize one declared scope for overlap comparison only. */
export declare function normalizeScope(scope: string): string;
/**
 * Test whether two declared scopes overlap. Equal paths and ancestor/descendant
 * directory relationships conflict; this is advisory and does not understand
 * symlinks, globs, or `..` traversal.
 * @param left - first declared scope.
 * @param right - second declared scope.
 * @returns true when the scopes overlap.
 */
export declare function scopesOverlap(left: string, right: string): boolean;
/**
 * Compare one session's declared scopes with peers' declarations.
 * @param declared - scopes the caller is about to change.
 * @param peers - other sessions and their declared scopes.
 * @returns peers with at least one overlapping scope, in input order.
 */
export declare function findScopeConflicts(declared: readonly string[], peers: readonly {
    readonly sessionId: string;
    readonly scopes: readonly string[];
}[]): ScopeConflict[];
/** Inputs for the model-facing relay envelope. */
export interface RelayTextInput {
    readonly senderSessionId: string;
    readonly senderTitle?: string;
    readonly sentAt: string;
    readonly message: string;
    readonly writeScopes: readonly string[];
    readonly conflicts?: readonly ScopeConflict[];
    readonly replyTo?: string;
}
/**
 * Build the model-facing relay envelope. The sender is explicitly marked as a
 * peer rather than the current user, and the trailing paragraph repeats the
 * authority boundary so the receiving model does not treat peer text as an
 * instruction with higher priority than the user's.
 * @param input - sender identity, time, body, and advisory scopes.
 * @returns the exact text stored in the receiving session's user message.
 */
export declare function buildRelayText(input: RelayTextInput): string;
/**
 * Sliding-window limiter keyed by sender→target pair. State is process-local;
 * a restart resets it, which is acceptable because the limit is abuse control,
 * not a durable quota.
 */
export declare class SlidingWindowRateLimiter {
    private readonly limit;
    private readonly windowMs;
    private readonly hits;
    constructor(limit: number, windowMs?: number);
    /**
     * Record one attempt when the pair is under its limit.
     * @param key - opaque sender→target pair key.
     * @param now - caller-supplied epoch milliseconds.
     * @returns true when the attempt is allowed and recorded.
     */
    allow(key: string, now: number): boolean;
    /** Drop one pair's history, or all history when no key is supplied. */
    clear(key?: string): void;
}
