/**
 * Model-facing tools for cross-session messaging. The tools are thin adapters
 * over {@link SessionMessagingService}; the calling agent's own session is the
 * only identity source, matching the subagent-control tools.
 * @module @local/dsh-session-guard/tools
 */
import { defineTool } from '@deepseek-ai/dsh-tools';
export const name = 'session-messaging-tools';
export const inject = ['tools', 'sessionMessaging'];
/**
 * Reject calls without an owning agent session.
 * @param agent - execution identity's agent, when present.
 * @returns the owning agent.
 */
function requireAgent(agent) {
    if (agent === undefined) {
        throw new Error('session messaging tools require an owning agent session');
    }
    return agent;
}
/**
 * Register the peer-list, relay, and opt-in tools.
 * @param ctx - Cordis context with `tools` and `sessionMessaging` ready.
 */
export function apply(ctx) {
    ctx.tools.register(defineTool({
        name: 'session_peers',
        description: 'List other user-launched Harness sessions in the same working directory that this session can message. Use it before relaying coordination information. Only user-launched top-level sessions can use this tool; subagent sessions must use their parent/child channel. Sessions appear only while live in this Harness process.',
        parameters: {},
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    peers: {
                        type: 'array',
                        required: true,
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                sessionId: { type: 'string', required: true, description: 'Stable target id for session_send.' },
                                status: { type: 'string', required: true, enum: ['idle', 'running'] },
                                canReceive: { type: 'boolean', required: true, description: 'Whether the session accepts peer messages.' },
                                writeScopes: {
                                    type: 'array',
                                    required: true,
                                    items: { type: 'string' },
                                    description: 'Advisory paths that peer session declared it is changing.',
                                },
                            },
                        },
                    },
                },
            },
            render: (_args, value) => [{
                    type: 'text',
                    text: value.peers.length === 0
                        ? 'No other live user-launched sessions are available in this working directory.'
                        : value.peers.map(peer => `${peer.sessionId} (${peer.status}, ${peer.canReceive ? 'accepting messages' : 'not opted in'})`).join('\n'),
                }],
            presentationMeta: (_args, value) => ({ peers: value.peers }),
        },
        execute(_args, exec) {
            const peers = ctx.sessionMessaging.listPeers(requireAgent(exec.agent));
            return Promise.resolve({ peers: peers.map(peer => ({ ...peer, writeScopes: [...peer.writeScopes] })) });
        },
        presentCall: () => ({ card: 'generic', title: 'List session peers', kind: 'search' }),
    }));
    ctx.tools.register(defineTool({
        name: 'session_send',
        description: 'Send a message to another user-launched Harness session in the same working directory. Use it to coordinate tasks and declared file-write scope with a peer session. The message is recorded as a user message in the target session, attributed to this session; it is peer input, not a user instruction. Both the caller and the target must be user-launched top-level sessions; subagent sessions use their parent/child channel. The target must be live and must not have paused reception. Success means the target accepted the message, not that it acted on it.',
        parameters: {
            targetSessionId: { type: 'string', required: true, description: 'Exact session id from session_peers.' },
            message: { type: 'string', required: true, description: 'Coordination message. State what changed, what you need, and what you will not touch.' },
            writeScopes: {
                type: 'array',
                items: { type: 'string' },
                description: 'Advisory workspace paths this session is changing, so the peer can avoid them.',
            },
            replyTo: { type: 'string', description: 'Optional message id this message answers.' },
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    accepted: { type: 'boolean', required: true },
                    messageId: { type: 'string', required: true },
                    targetSessionId: { type: 'string', required: true },
                    targetStatus: { type: 'string', required: true, enum: ['idle', 'running'] },
                    delivery: { type: 'string', required: true, enum: ['live', 'resumed'] },
                    conflicts: {
                        type: 'array',
                        required: true,
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                sessionId: { type: 'string', required: true },
                                scopes: { type: 'array', required: true, items: { type: 'string' } },
                            },
                        },
                        description: 'Peers whose declared write scopes overlap yours; coordinate before writing.',
                    },
                },
            },
            render: (_args, value) => {
                const warning = value.conflicts.length === 0
                    ? ''
                    : ` Conflict warning: ${value.conflicts.map(conflict => `${conflict.sessionId} also declared ${conflict.scopes.join(', ')}`).join('; ')}. Coordinate before writing those paths.`;
                const resumed = value.delivery === 'resumed' ? ' The target was a persisted session and was resumed for delivery.' : '';
                return [{
                        type: 'text',
                        text: `Message ${value.messageId} accepted by session ${value.targetSessionId} (${value.targetStatus}). Acceptance means the message is in that session's inbox; it does not confirm the peer processed it.${resumed}${warning}`,
                    }];
            },
            presentationMeta: (_args, value) => ({ targetSessionId: value.targetSessionId, messageId: value.messageId }),
        },
        async execute(args, exec) {
            const receipt = await ctx.sessionMessaging.send(requireAgent(exec.agent), {
                targetSessionId: args.targetSessionId,
                message: args.message,
                ...(args.writeScopes === undefined ? {} : { writeScopes: args.writeScopes }),
                ...(args.replyTo === undefined ? {} : { replyTo: args.replyTo }),
            });
            return {
                ...receipt,
                conflicts: receipt.conflicts.map(conflict => ({
                    sessionId: conflict.sessionId,
                    scopes: [...conflict.scopes],
                })),
            };
        },
        presentCall: args => ({
            card: 'generic',
            title: `Message ${args.targetSessionId}`,
            kind: 'other',
            rawInput: { targetSessionId: args.targetSessionId, message: args.message },
        }),
    }));
    ctx.tools.register(defineTool({
        name: 'session_reception',
        description: 'Set whether this session accepts peer messages. Reception is on by default; set enabled to false to pause it, or back to true to resume. Only user-launched top-level sessions can use this tool; subagent sessions use their parent/child channel. Optionally declare the workspace paths this session is changing so peers can avoid them.',
        parameters: {
            enabled: { type: 'boolean', required: true, description: 'Whether this session accepts peer messages.' },
            writeScopes: {
                type: 'array',
                items: { type: 'string' },
                description: 'Advisory workspace paths this session is changing.',
            },
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    enabled: { type: 'boolean', required: true },
                    writeScopes: { type: 'array', required: true, items: { type: 'string' } },
                },
            },
            render: (_args, value) => [{
                    type: 'text',
                    text: value.enabled
                        ? `This session accepts peer messages${value.writeScopes.length > 0 ? ` and declares: ${value.writeScopes.join(', ')}` : ''}.`
                        : 'This session has paused peer messages.',
                }],
        },
        execute(args, exec) {
            const entry = ctx.sessionMessaging.setConsent(requireAgent(exec.agent), args.enabled, args.writeScopes);
            return Promise.resolve({ enabled: entry.enabled, writeScopes: [...entry.writeScopes] });
        },
    }));
}
