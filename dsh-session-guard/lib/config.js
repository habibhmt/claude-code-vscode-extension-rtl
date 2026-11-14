/**
 * Deployment configuration for the session-messaging plugin. Every value that
 * two deployments may want to set differently is a schema field; the loader
 * validates it at load time and fails loudly on invalid input.
 * @module @local/dsh-session-guard/config
 */
import Schema from '@deepseek-ai/schemastery';
import { DEFAULT_MAX_MESSAGE_CHARS, DEFAULT_MAX_MESSAGES_PER_MINUTE } from "./protocol.js";
/** Schemastery schema for the plugin row's `config` block. */
export const Config = Schema.object({
    maxMessageChars: Schema.number().min(1).default(DEFAULT_MAX_MESSAGE_CHARS),
    maxMessagesPerMinute: Schema.number().min(1).default(DEFAULT_MAX_MESSAGES_PER_MINUTE),
    requireTargetOptIn: Schema.boolean().default(false),
    sameDirectoryOnly: Schema.boolean().default(false).volatile(),
    allowSelfSend: Schema.boolean().default(false),
    allowColdDelivery: Schema.boolean().default(true),
});
