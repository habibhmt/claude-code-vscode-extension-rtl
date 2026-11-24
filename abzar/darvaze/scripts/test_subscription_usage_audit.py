import unittest,copy,datetime as dt
from subscription_usage_audit import Audit,timestamp,FIELDS
class TestAudit(unittest.TestCase):
 def make(self):return Audit(timestamp('2026-10-17T00:00:00+03:30'),timestamp('2026-11-14T00:00:00+03:30'))
 def record(self):return {'type':'assistant','timestamp':'2026-11-01T10:00:00Z','requestId':'req_x','message':{'id':'msg_x','model':'claude-opus-5-5','usage':dict(zip(FIELDS,[10,20,30,40]))}}
 def test_duplicate_across_files_not_double_billed(self):
  a=self.make();r=self.record();a.add(r,'a',1);a.add(copy.deepcopy(r),'b',9)
  rows=list(a.rows());self.assertEqual(len(rows),1);self.assertEqual(rows[0]['total_input_tokens'],60);self.assertEqual(rows[0]['records'],2)
 def test_corrupt_usage_is_rejected(self):
  for corrupt in [-1,'40',True,None]:
   a=self.make();r=self.record();r['message']['usage']['output_tokens']=corrupt;a.add(r,'x',1);self.assertEqual(list(a.rows()),[]);self.assertEqual(a.c['invalid_or_missing_usage_records'],1)
 def test_revision_not_summed(self):
  a=self.make();r=self.record();a.add(r,'x',1);r=copy.deepcopy(r);r['message']['usage']['output_tokens']=80;a.add(r,'x',2);row=list(a.rows())[0];self.assertEqual(row['usage']['output_tokens'],80);self.assertTrue(row['monotonic_revision'])
 def test_nonmonotonic_conflict_flagged(self):
  a=self.make();r=self.record();a.add(r,'x',1);r=copy.deepcopy(r);r['message']['usage']['input_tokens']=9;r['message']['usage']['output_tokens']=80;a.add(r,'x',2);self.assertEqual(list(a.rows())[0]['bucket'],'usage_conflict')
 def test_synthetic_excluded(self):
  a=self.make();r=self.record();r['message']['model']='<synthetic>';a.add(r,'x',1);self.assertEqual(list(a.rows()),[])
 def test_claude_is_not_subscription_proof(self):
  a=self.make();a.add(self.record(),'x',1);self.assertEqual(list(a.rows())[0]['bucket'],'anthropic_payment_unknown')
 def test_openrouter_claude_excluded_from_unknown(self):
  a=self.make();r=self.record();r['requestId']='gen-123';a.add(r,'x',1);self.assertEqual(list(a.rows())[0]['bucket'],'known_openrouter')
 def test_thinking_iterations_not_double_added(self):
  a=self.make();r=self.record();r['message']['usage'].update({'output_tokens_details':{'thinking_tokens':25},'iterations':[{'output_tokens':40}]});a.add(r,'x',1);row=list(a.rows())[0];self.assertEqual(row['usage']['output_tokens'],40);self.assertEqual(row['thinking_tokens_in_output'],25)
if __name__=='__main__':unittest.main()
