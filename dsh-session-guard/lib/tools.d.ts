/**
 * Model-facing tools for cross-session messaging. The tools are thin adapters
 * over {@link SessionMessagingService}; the calling agent's own session is the
 * only identity source, matching the subagent-control tools.
 * @module dsh-session-messaging/tools
 */
import type { Context } from '@deepseek-ai/cordis';
export declare const name = "session-messaging-tools";
export declare const inject: string[];
/**
 * Register the peer-list, relay, and opt-in tools.
 * @param ctx - Cordis context with `tools` and `sessionMessaging` ready.
 */
export declare function apply(ctx: Context): void;
