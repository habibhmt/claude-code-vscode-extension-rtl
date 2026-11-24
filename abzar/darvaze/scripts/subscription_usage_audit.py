#!/usr/bin/env python3
"""Metadata-only, read-only usage extraction. Never equate Claude model with subscription."""
import argparse, collections, datetime as dt, hashlib, json, os
from pathlib import Path
from zoneinfo import ZoneInfo
TZ=ZoneInfo('Asia/Tehran')
FIELDS=('input_tokens','cache_creation_input_tokens','cache_read_input_tokens','output_tokens')
def timestamp(value):
    if not isinstance(value,str): return None
    try:
        x=dt.datetime.fromisoformat(value.replace('Z','+00:00'))
        return x if x.tzinfo else x.replace(tzinfo=dt.timezone.utc)
    except ValueError: return None

def usage_vector(u):
    if not isinstance(u,dict): raise ValueError('missing usage')
    out=[]
    for k in FIELDS:
        v=u.get(k,0 if k.startswith('cache_') else None)
        if isinstance(v,bool) or not isinstance(v,int) or v<0: raise ValueError('invalid '+k)
        out.append(v)
    return tuple(out)

def classify(model,request_id,provider):
    if model=='<synthetic>':return 'synthetic'
    if (request_id or '').startswith('gen-'):return 'known_openrouter'
    if model and ('deepseek' in model.lower() or not model.lower().startswith('claude')):return 'other_model'
    return 'anthropic_payment_unknown'

class Audit:
    def __init__(self,start,end):
        self.start=start; self.end=end; self.groups={}; self.c=collections.Counter(); self.types=collections.Counter();self.file_errors=[];self.api_requests=set();self.files=[];self.api_meta={};self.auth_ids=set()
    def add(self,d,source,line_no):
        self.c['records_read']+=1
        outer=d
        if isinstance(d.get('payload'),dict) and 'event_type' in d:
            d=dict(d['payload']);d.setdefault('timestamp',outer.get('created_at'));self.c['cloud_wrapped_records']+=1
        typ=d.get('type','unknown');self.types[typ]+=1
        t=timestamp(d.get('timestamp') or d.get('_audit_timestamp'))
        if typ=='api-request' and t and self.start<=t<self.end:
            self.api_requests.add((d.get('sessionId'),d.get('id')))
            self.api_meta[(d.get('sessionId'),d.get('id'))]=d.get('querySource')
        if typ!='assistant':return
        self.c['assistant_records_all_dates']+=1
        if not t:self.c['assistant_missing_time']+=1;return
        if not self.start<=t<self.end:return
        self.c['assistant_records_in_period']+=1
        m=d.get('message')
        if not isinstance(m,dict):self.c['assistant_missing_message']+=1;return
        model=m.get('model');rid=d.get('requestId');mid=m.get('id');provider=m.get('provider')
        bucket=classify(model,rid,provider)
        if bucket=='synthetic':self.c['synthetic_assistant_records']+=1;return
        if not model:self.c['assistant_missing_model']+=1;return
        try:v=usage_vector(m.get('usage'))
        except ValueError:self.c['invalid_or_missing_usage_records']+=1;return
        if not mid and not rid:
            self.c['assistant_missing_billing_id']+=1;return
        # Message IDs identify a response across duplicated transcript copies and streaming blocks.
        # Request ID alone is fallback; report request-to-multiple-message cases separately.
        key='m:'+mid if mid else 'r:'+rid
        if key not in self.groups:
            self.groups[key]={'id':key,'message_id':mid,'request_ids':set(),'request_refs':set(),'sessions':set(),'models':set(),'providers':set(),'buckets':set(),'snapshots':{},'first':t,'last':t,'records':0,'sources':set(),'subagent':False}
        g=self.groups[key];g['models'].add(model);g['buckets'].add(bucket);g['records']+=1;g['first']=min(g['first'],t);g['last']=max(g['last'],t);g['sources'].add(source);g['subagent'] |= '/subagents/' in source or bool(d.get('isSidechain'))
        if provider:g['providers'].add(provider)
        if rid:g['request_ids'].add(rid)
        if d.get('requestRef'):g['request_refs'].add(d['requestRef'])
        if d.get('sessionId') or d.get('session_id'):g['sessions'].add(d.get('sessionId') or d.get('session_id'))
        thinking=(m.get('usage') or {}).get('output_tokens_details') or {}
        thinking=thinking.get('thinking_tokens')
        g['snapshots'][v]={'last':t,'thinking_tokens':thinking if isinstance(thinking,int) and not isinstance(thinking,bool) and thinking>=0 else None}
    def scan(self,roots):
        seen=set()
        for root in roots:
            for p in sorted(Path(root).rglob('*.jsonl')):
                real=str(p.resolve())
                if real in seen:continue
                seen.add(real);before=p.stat();bad=0;lines=0
                try:
                    with p.open('rb') as f:
                        while f.tell()<before.st_size:
                            line=f.readline();lines+=1
                            try:d=json.loads(line)
                            except (ValueError,UnicodeDecodeError):bad+=1;continue
                            if isinstance(d,dict):self.add(d,real,lines)
                except OSError as e:self.file_errors.append({'file':real,'error_type':type(e).__name__})
                after=p.stat()
                self.files.append({'path':real,'initial_bytes':before.st_size,'lines':lines,'malformed_lines':bad,'grew_during_read':after.st_size!=before.st_size})
                self.c['malformed_json_lines']+=bad
    def rows(self):
        for g in self.groups.values():
            vectors=list(g['snapshots'])
            dominant=[v for v in vectors if all(all(a>=b for a,b in zip(v,w)) for w in vectors)]
            conflict=len(g['models'])!=1 or not dominant
            chosen=dominant[0] if dominant else max(vectors,key=lambda v:g['snapshots'][v]['last'])
            bucket='usage_conflict' if conflict else ('known_openrouter' if 'known_openrouter' in g['buckets'] else sorted(g['buckets'])[0])
            if bucket=='anthropic_payment_unknown' and g['request_ids'] & self.auth_ids: bucket='verified_max_oauth'
            yield {'query_sources':sorted({self.api_meta[(sid,ref)] for sid in g['sessions'] for ref in g['request_refs'] if self.api_meta.get((sid,ref))}), 'id':g['id'],'message_id':g['message_id'],'request_ids':sorted(g['request_ids']),'request_refs':sorted(g['request_refs']),'sessions':sorted(g['sessions']),'models':sorted(g['models']),'providers':sorted(g['providers']),'bucket':bucket,'timestamp':g['first'].isoformat(),'last_timestamp':g['last'].isoformat(),'tehran_day':g['first'].astimezone(TZ).date().isoformat(),'usage':dict(zip(FIELDS,chosen)),'total_input_tokens':sum(chosen[:3]),'thinking_tokens_in_output':g['snapshots'][chosen]['thinking_tokens'],'usage_variants':len(vectors),'monotonic_revision':len(vectors)>1 and not conflict,'records':g['records'],'source_files':sorted(g['sources']),'subagent':g['subagent'],'conflicting_usage_vectors':[list(v) for v in vectors] if conflict else []}
    def summary(self,rows):
        totals={};byday={};bymodel={};byroot=collections.Counter();reqmap=collections.defaultdict(set)
        def add(group,k,row):
            b=group.setdefault(k,{'requests':0,**{f:0 for f in FIELDS},'total_input_tokens':0,'thinking_tokens_reported':0,'thinking_metadata_missing':0})
            b['requests']+=1
            for f in FIELDS:b[f]+=row['usage'][f]
            b['total_input_tokens']+=row['total_input_tokens']
            if row['thinking_tokens_in_output'] is None:b['thinking_metadata_missing']+=1
            else:b['thinking_tokens_reported']+=row['thinking_tokens_in_output']
        for r in rows:
            add(totals,r['bucket'],r);add(byday,r['tehran_day']+'|'+r['bucket'],r);add(bymodel,','.join(r['models'])+'|'+r['bucket'],r)
            for rid in r['request_ids']:reqmap[rid].add(r['id'])
        return {'period_start':self.start.isoformat(),'period_end_exclusive':self.end.isoformat(),'timezone':'Asia/Tehran','counts':dict(self.c),'record_types':dict(self.types),'files_scanned':len(self.files),'initial_bytes_scanned':sum(f['initial_bytes'] for f in self.files),'unique_responses':len(rows),'duplicate_or_stream_blocks_removed':sum(r['records']-1 for r in rows),'responses_in_multiple_files':sum(len(r['source_files'])>1 for r in rows),'monotonic_usage_revisions':sum(r['monotonic_revision'] for r in rows),'requests_with_multiple_message_ids':{k:sorted(v) for k,v in reqmap.items() if len(v)>1},'api_request_records_unique':len(self.api_requests),'api_requests_without_retained_response':len(self.api_requests-{(s,ref) for r in rows for s in r['sessions'] for ref in r['request_refs']}),'totals_by_bucket':totals,'by_model':bymodel,'by_day':byday,'file_errors':self.file_errors,'limits':['Claude model names do not prove subscription billing. No auth classification is inferred from model.','Partial/failed/hidden calls without assistant usage are not billable totals here.','Token counts are reported by the source model, not a DeepSeek retokenization.','Thinking tokens are a subset of output; iterations and cost-state snapshots are not added.','Root coverage is only supplied files, not proof of whole account.','First timestamp approximates response time; billing boundary exact timezone/hour is unknown.']}

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--root',action='append',required=True);ap.add_argument('--start',default='2026-10-17T00:00:00+03:30');ap.add_argument('--end',default=dt.datetime.now(TZ).isoformat());ap.add_argument('--auth-ids');ap.add_argument('--out',default='.runtime/cost-audit/usage');a=ap.parse_args()
    audit=Audit(timestamp(a.start),timestamp(a.end));audit.auth_ids=set(json.loads(Path(a.auth_ids).read_text())) if a.auth_ids else set();audit.scan(a.root);rows=sorted(audit.rows(),key=lambda r:r['timestamp']);base=Path(a.out);base.parent.mkdir(parents=True,exist_ok=True)
    for suffix,data in [('-summary.json',audit.summary(rows)),('-files.json',audit.files)]:
        p=Path(str(base)+suffix);p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');p.chmod(0o600)
    p=Path(str(base)+'-requests.jsonl');p.write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in rows));p.chmod(0o600)
    print(json.dumps({'summary':str(base)+'-summary.json','unique_responses':len(rows),'files':len(audit.files),'buckets':audit.summary(rows)['totals_by_bucket']}))
if __name__=='__main__':main()
