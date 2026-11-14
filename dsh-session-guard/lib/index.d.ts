/**
 * Plugin entry: the Host-side session-messaging service. The model-facing tools
 * live in the `./tools` entry. This module intentionally exports no new Session
 * event type; relayed messages reuse `user/message` with a declared source kind.
 * @module dsh-session-messaging
 */
export { default } from './service.ts';
export { SessionMessagingService } from './service.ts';
export { Config } from './config.ts';
export type { SessionMessagingConfig } from './config.ts';
export { SESSION_MESSAGE_KIND } from './protocol.ts';
export type { MessagingErrorCode, PeerView, SendReceipt, SendRequest, } from './protocol.ts';
