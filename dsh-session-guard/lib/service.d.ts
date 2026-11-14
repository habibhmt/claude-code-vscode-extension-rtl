/**
 * Host-side session-messaging service. It discovers live user-launched peers in
 * the same working directory, enforces opt-in plus rate limits, and relays a
 * message through the target agent's inbox as a durable `user/message` with the
 * plugin's `session-message` source. It never appends a new Session event kind,
 * so the session format and its readers stay unchanged.
 * @module dsh-session-messaging/service
 */
import { Service, type Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import { Config } from './config.ts';
import type { ResolvedSessionMessagingConfig } from './config.ts';
import type { PeerView, SendReceipt, SendRequest } from './protocol.ts';
/** One session's receive consent and advisory write scopes. */
interface ConsentEntry {
    readonly enabled: boolean;
    readonly writeScopes: readonly string[];
    readonly updatedAt: number;
}
declare module '@deepseek-ai/cordis' {
    interface Context {
        /** Cross-session messaging service provided by this plugin. */
        sessionMessaging: SessionMessagingService;
    }
}
/**
 * Relay service shared by the model-facing tools. It exposes only same-process,
 * live, top-level sessions in the current MVP; cold-session delivery and
 * durable consent are follow-up work.
 */
export declare class SessionMessagingService extends Service {
    static inject: string[];
    /** Loader-read configuration schema; defaults apply when the row omits `config`. */
    static Config: import("@deepseek-ai/schemastery").default<Schemastery.ObjectS<NoInfer<{
        maxMessageChars: import("@deepseek-ai/schemastery").default<number, number, "defined">;
        maxMessagesPerMinute: import("@deepseek-ai/schemastery").default<number, number, "defined">;
        requireTargetOptIn: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
        sameDirectoryOnly: import("@deepseek-ai/schemastery").default<boolean, boolean, "volatile-defined">;
        allowSelfSend: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
        allowColdDelivery: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
    }>>, Schemastery.ObjectT<NoInfer<{
        maxMessageChars: import("@deepseek-ai/schemastery").default<number, number, "defined">;
        maxMessagesPerMinute: import("@deepseek-ai/schemastery").default<number, number, "defined">;
        requireTargetOptIn: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
        sameDirectoryOnly: import("@deepseek-ai/schemastery").default<boolean, boolean, "volatile-defined">;
        allowSelfSend: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
        allowColdDelivery: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
    }>>, "plain">;
    private readonly config;
    private readonly limiter;
    private readonly consent;
    /**
     * @param ctx - Cordis context with `agents` and `sessions` ready.
     * @param config - validated plugin configuration.
     */
    constructor(ctx: Context, config: ResolvedSessionMessagingConfig);
    /**
     * List live user-launched peers the caller may address.
     * @param caller - the agent whose tool call is inspecting peers.
     * @returns peer views ordered by session registration.
     */
    listPeers(caller: Agent): PeerView[];
    /**
     * Set this session's reception state and advisory write scopes.
     * Sessions are mutually visible and can message each other by default; pass
     * `enabled: false` to pause reception explicitly.
     * @param caller - the session being configured.
     * @param enabled - whether peers may relay messages to this session.
     * @param writeScopes - advisory scopes this session is currently changing.
     * @returns the stored consent entry.
     */
    setConsent(caller: Agent, enabled: boolean, writeScopes?: readonly string[]): ConsentEntry;
    /**
     * Reject callers that are not user-launched top-level sessions.
     *
     * The peer channel is deliberately symmetric: a subagent is neither listed
     * nor allowed to relay. Subagent sessions keep using the existing
     * parent/child `send_message` channel instead of a one-way cross-session
     * side channel. A sidebar fork is user-launched and stays top-level: fork
     * seed lineage is not a delegation marker.
     * @param caller - the agent whose tool call is being validated.
     * @throws {MessagingError} with `caller-not-top-level` for a delegated child.
     */
    private assertTopLevelCaller;
    /**
     * Enforce per-target consent and the sender→target rate limit once.
     * @param caller - sending agent.
     * @param targetId - target session identity.
     */
    private checkConsentAndRate;
    /**
     * Resume a persisted, non-live session through the deployment's session
     * controller. Web and Desktop mount one; profiles without it keep the
     * `target-not-live` refusal.
     * @param targetId - persisted session identity to resume.
     * @returns the resumed live Agent.
     * @throws {MessagingError} with `target-not-live` without a controller, or
     *   `cold-delivery-failed` when resume refuses.
     */
    private resumeColdAgent;
    /**
     * Relay one message to a live peer session, resuming a persisted session
     * first when `allowColdDelivery` is enabled.
     *
     * Success means the target agent accepted the message into its inbox and the
     * session flush acknowledged persistence. It does not mean the target model
     * has read or acted on it.
     * @param caller - sending agent, taken from the tool execution identity.
     * @param request - target, body, and optional advisory scopes.
     * @returns a receipt with the sender-minted message id.
     * @throws {MessagingError} for every refused or failed delivery.
     */
    send(caller: Agent, request: SendRequest): Promise<SendReceipt>;
}
/** Loader configuration schema re-exported from this module for tooling that imports the class directly. */
export { Config };
export default SessionMessagingService;
