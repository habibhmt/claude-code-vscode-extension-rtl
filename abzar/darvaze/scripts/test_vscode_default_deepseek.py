import unittest
from unittest.mock import patch
import vscode_default_deepseek as d
from claude_deepseek import PilotError
class DefaultTests(unittest.TestCase):
 def test_gateway_setup_failure_does_not_start_claude(self):
  with patch.object(d.sys,'argv',['adapter','native','--print','hello']),patch.object(d,'prepare',side_effect=PilotError('no endpoint')),patch.object(d.os,'execve') as execute:
   self.assertEqual(d.main(),1);execute.assert_not_called()
 def test_preserves_prior_tool_wrapper(self):
  with patch.object(d.sys,'argv',['adapter','native','--print','hello']),patch.object(d,'read_key',return_value='sk-or-fixture'),patch.object(d,'prepare',return_value=(['native','--model','deepseek-fixture'],{'X':'Y'})),patch.object(d.os,'execve') as execute:
   d.main();execute.assert_called_once_with(str(d.PREVIOUS),[str(d.PREVIOUS),'native','--model','deepseek-fixture'],{'X':'Y'})
 def test_helper_does_not_read_credentials(self):
  with patch.object(d.sys,'argv',['adapter','native','--version']),patch.object(d,'read_key') as key,patch.object(d,'prepare',return_value=(['native','--version'],None)),patch.object(d.os,'execve'):
   d.main();key.assert_not_called()
if __name__=='__main__':unittest.main()
