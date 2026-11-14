/**
 * Durable message-source declaration for relayed session messages. Importing
 * this module for its types adds the `session-message` kind to
 * `MessageSourceMap`, which is what makes the receiving `user/message`
 * reconstructable from the session log.
 * @module dsh-session-messaging/types
 */
import type { SessionId } from '@deepseek-ai/dsh-session';
declare module '@deepseek-ai/dsh-llm' {
    interface MessageSourceMap {
        /** A message another user-launched session relayed to this one. */
        'session-message': {
            readonly kind: 'session-message';
            /** Shared relay form used by existing agent-to-agent messages. */
            readonly form: 'relay';
            /** Session id of the sending session. */
            readonly senderSessionId: SessionId;
            /** Sender-minted correlation id for receipts and replies. */
            readonly messageId: string;
        };
    }
}
export {};
