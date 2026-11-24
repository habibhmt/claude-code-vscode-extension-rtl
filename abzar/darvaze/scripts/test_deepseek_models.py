import json, unittest
from pathlib import Path
import patch_deepseek_models as patcher
class SelectorTests(unittest.TestCase):
 def test_actual_backup_patches_both_selectors(self):
  old=patcher.BACKUP.read_text();new=patcher.patch_text(old)
  self.assertNotIn('models:ne.models,unavailable_models:ne.unavailable_models',new)
  self.assertNotIn('async supportedModels(){return(await this.initialization).models}',new)
  self.assertEqual(new.count(patcher.READER),5)
  self.assertEqual(patcher.patch_text(new),new)
 def test_sabotage_missing_anchor_is_rejected(self):
  old=patcher.BACKUP.read_text().replace('models:ne.models,unavailable_models:ne.unavailable_models','models:broken',1)
  with self.assertRaises(ValueError):patcher.patch_text(old)
 def test_sabotage_marker_without_overlay_is_rejected(self):
  old=patcher.MARK+"\n"+patcher.BACKUP.read_text().replace("let r=(await n).response;","broken",1)
  with self.assertRaises(ValueError):patcher.patch_text(old)
 def test_catalog_only_deepseek_and_no_batch_or_fable(self):
  models=json.loads(patcher.CATALOG.read_text())
  self.assertTrue(models)
  self.assertTrue(all(m['value'].startswith(('deepseek/','claude-')) and ':' not in m['value'] for m in models))
  self.assertNotIn('fable',json.dumps(models).lower())
if __name__=='__main__':unittest.main()
