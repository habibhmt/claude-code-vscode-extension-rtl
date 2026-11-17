/** Convert the visible branch of a Claude Code transcript into native DSH events.
 * Replaying these records renders past commands. It never invokes a tool or model.
 */
import fs from 'node:fs/promises'
import { BRIDGE } from './history-claude.mjs'

const importedId = (uuid, slot) => 'claude-history:' + uuid + ':' + slot
const roles = new Set(['user', 'assistant'])
const toolNames = { Bash: 'bash', Read: 'read', Write: 'write', Edit: 'edit', Grep: 'grep', Glob: 'glob' }

function textBlocks(content, { toolResult = false } = {}) {
  if (typeof content === 'string') return content ? [{ type: 'text', text: content }] : []
  const blocks = []
  for (const block of Array.isArray(content) ? content : []) {
    if (block?.type === 'text' && typeof block.text === 'string') blocks.push({ type: 'text', text: block.text })
    else if (toolResult && block?.type === 'tool_reference' && typeof block.tool_name === 'string' && block.tool_name) {
      // ToolSearch returns names, not prose. Keep them visible as history without activating a tool.
      blocks.push({ type: 'text', text: block.tool_name })
    } else if (block?.type === 'image' && block.source?.type === 'base64') {
      blocks.push({ type: 'image', mimeType: block.source.media_type, data: block.source.data })
    }
  }
  return blocks
}

export async function readClaudeTranscript(file, sid, cwd) {
  let text
  try { text = await fs.readFile(file, 'utf8') } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
  const end = text.lastIndexOf('\n')
  const byId = new Map()
  let leaf, tail, title, bridgeOwned = false, correctWorkspace = false, titleIsExplicit = false
  for (const line of text.slice(0, end + 1).split('\n')) {
    if (!line.trim()) continue
    const item = JSON.parse(line)
    if (item.dshBridge?.kind === BRIDGE) bridgeOwned = true
    if (item.sessionId && item.sessionId !== sid && roles.has(item.type)) {
      // Claude-native forks can contain a prefix with their parent's sessionId.
      // Retain its ancestry for display. The file must also identify its own cwd/session.
    } else if (roles.has(item.type) && item.sessionId === sid && item.cwd === cwd) correctWorkspace = true
    if (item.type === 'custom-title' && item.customTitle) { title = item.customTitle; titleIsExplicit = true }
    if (!titleIsExplicit && item.type === 'ai-title' && item.aiTitle) title = item.aiTitle
    if (!item.uuid || item.isSidechain) continue
    byId.set(item.uuid, item)
    if (roles.has(item.type)) { leaf = item; tail = item.uuid }
  }
  if (!leaf || !correctWorkspace) return null
  const branch = [], visited = new Set()
  while (leaf && !visited.has(leaf.uuid)) {
    visited.add(leaf.uuid)
    if (roles.has(leaf.type) && !leaf.isMeta && !leaf.isCompactSummary) branch.push(leaf)
    leaf = byId.get(leaf.parentUuid ?? leaf.logicalParentUuid)
  }
  branch.reverse()
  // Claude's requested model can include a provider preset that the model in
  // the API response omits. Use the native record from this conversation.
  const native = branch.findLast(row => row.type === 'assistant' && row.sessionId === sid && row.cwd === cwd &&
    !row.dshSource && !row.isApiErrorMessage && typeof row.requestedModel === 'string' && row.requestedModel)
  let selection
  if (native) {
    selection = { model:native.requestedModel }
    const effort = native.perTurnEffort ?? native.effort
    if (['low','medium','high','xhigh','max'].includes(effort)) selection.effort = effort
    else if (['auto','default',null].includes(effort) && Object.hasOwn(native,'effort')) selection.effort = null
  }
  return { branch, tail, title, bridgeOwned, selection }
}

function visibleRow(row, sessionId) {
  if (row.dshSource?.sessionId === sessionId || row.dshBridge?.kind === BRIDGE) return false
  // Internal prompts, local slash commands and hook attachments aren't human turns.
  if (row.type === 'user' && row.promptSource && row.promptSource !== 'user' && row.isMeta) return false
  return !!row.message
}

/** prior is the authoritative DSH log, including the native turns of a shared chat. */
export function fromClaude(transcript, { sessionId, prior = [], createdAt = Date.now() }) {
  const events = [], seen = new Set(), calls = new Map()
  const importedResults = new Map(), replacements = [], repairs = []
  let turn = 0, step = 0, active = false, lastTime = createdAt
  let hasHead = false, hasReply = false, pending = new Set()
  let knownTitle
  for (const e of prior) {
    if (e.type === 'turn/start') turn = Math.max(turn, e.data.turn || 0)
    if (e.type === 'system/message' && e.surfaceOp === 'append') hasHead = true
    if (e.type === 'session/title') knownTitle = e.data.title
    if (e.type === 'tool/call') calls.set(e.data.callId, e.seq)
    const msg = e.type === 'user/message' ? e.data : e.data?.message
    if (typeof msg?.id === 'string') seen.add(msg.id)
    if (e.type === 'tool/result' && e.surfaceOp === 'append' && msg?.id?.startsWith('claude-history:')) importedResults.set(msg.id, e)
    if (e.surfaceOp?.op === 'replace') replacements.push(e.surfaceOp)
  }
  function add(type, data, extra = {}) {
    const seq = prior.length + events.length
    events.push({ seq, time: lastTime, type, data, ...extra })
    return seq
  }
  function close() {
    if (!active) return
    add('step/end', { turn, step })
    const reason = hasReply && !pending.size ? { kind: 'completed' } : { kind: 'aborted', reason: 'incomplete transcript' }
    add('turn/end', { turn, reason })
    active = false
  }
  function start() {
    if (active) return
    active = true; hasReply = false; pending = new Set()
    turn++; step = 1
    add('turn/start', { turn })
    add('step/start', { turn, step })
    if (!hasHead) {
      add('system/message', { turn, step, message: { id: importedId(sessionId, 'system'), role: 'system', source: { kind: 'system-prompt' }, content: [] } }, { surfaceOp: 'append' })
      hasHead = true
    }
  }
  for (const row of transcript.branch) {
    if (!visibleRow(row, sessionId)) continue
    const date = Date.parse(row.timestamp)
    if (Number.isFinite(date)) lastTime = date
    const blocks = Array.isArray(row.message.content) ? row.message.content : []
    const texts = textBlocks(row.message.content)
    if (row.type === 'user') {
      for (const [i, result] of blocks.entries()) {
        if (result.type !== 'tool_result') continue
        const id = importedId(row.uuid, 'result-' + i)
        const callId = result.tool_use_id
        if (!calls.has(callId)) continue
        const content = textBlocks(result.content, { toolResult: true })
        if (seen.has(id)) {
          const old = importedResults.get(id)
          if (!old || old.data.message.toolCallId !== callId || !Array.isArray(result.content) || !result.content.some(b => b?.type === 'tool_reference')) continue
          const oldContent = JSON.stringify(old.data.message.content)
          if (oldContent === JSON.stringify(content) || oldContent !== JSON.stringify(textBlocks(result.content))) continue
          // Repair only an intact result from the first importer. Compacted or edited history stays owned by DSH.
          if (replacements.some(r => r.startSeq <= old.seq && old.seq <= r.endSeq)) continue
          repairs.push({ old, content })
          importedResults.delete(id)
          continue
        }
        start()
        add('tool/result', { turn, step, message: { id, role: 'tool', source: { kind: 'tool', callId }, toolCallId: callId, isError: result.is_error === true, content } }, { surfaceOp: 'append', sourceEventSeqs: [calls.get(callId)] })
        pending.delete(callId)
        seen.add(id)
      }
      const id = importedId(row.uuid, 'user')
      if (!texts.length || seen.has(id)) continue
      close()
      start()
      add('user/message', { id, role: 'user', content: texts, source: { kind: 'user' } }, { surfaceOp: 'append' })
      seen.add(id)
    } else if (row.type === 'assistant') {
      const id = importedId(row.uuid, 'assistant')
      if (seen.has(id)) continue
      const content = []
      for (const block of blocks) {
        if (block.type === 'text' && typeof block.text === 'string') content.push({ type: 'text', text: block.text })
        if (block.type === 'tool_use' && block.id && block.name) content.push({ type: 'tool-call', id: block.id, name: toolNames[block.name] || block.name, arguments: JSON.stringify(block.input ?? {}) })
      }
      if (!blocks.length) content.push(...texts)
      if (!content.length) continue
      start()
      if (hasReply) { add('step/end', { turn, step }); step++; add('step/start', { turn, step }) }
      hasReply = true
      const message = { id, role: 'assistant', source: { kind: 'model', provider: 'claude-code', model: row.message.model || 'claude-code' }, content }
      add('assistant/message', { turn, step, message, stream: [] }, { surfaceOp: 'append' })
      for (const block of content) {
        if (block.type !== 'tool-call') continue
        const seq = add('tool/call', { turn, step, callId: block.id, name: block.name, arguments: block.arguments })
        calls.set(block.id, seq); pending.add(block.id)
      }
      seen.add(id)
    }
  }
  close()
  if (repairs.length) {
    // The V4 storage reader requires an open turn for replacements, including
    // historical ones. A maintenance turn has no user message, model step or call.
    turn++
    add('turn/start', { turn })
    for (const { old, content } of repairs) {
      add('tool/result', { ...old.data, message: { ...old.data.message, content } }, {
        surfaceOp: { op: 'replace', startSeq: old.seq, endSeq: old.seq }, sourceEventSeqs: [old.seq],
      })
    }
    add('turn/end', { turn, reason: { kind: 'completed' } })
  }
  if (transcript.title && transcript.title !== knownTitle) {
    add('session/title', { title: transcript.title, messageSeqs: [], source: { kind: 'user' } })
  }
  return events
}

export function liveAppendInputs(events) {
  return events.map(({ type, data, surfaceOp, sourceEventSeqs }) => surfaceOp
    ? [type, data, { surfaceOp, ...(sourceEventSeqs ? { sourceEventSeqs } : {}) }] : [type, data])
}
