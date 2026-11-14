/**
 * Plugin entry: the Host-side session-messaging service. The model-facing tools
 * live in the `./tools` entry. This module intentionally exports no new Session
 * event type; relayed messages reuse `user/message` with a declared source kind.
 * @module @local/dsh-session-guard
 */
export { default } from "./service.js";
export { SessionMessagingService } from "./service.js";
export { Config } from "./config.js";
export { SESSION_MESSAGE_KIND } from "./protocol.js";
