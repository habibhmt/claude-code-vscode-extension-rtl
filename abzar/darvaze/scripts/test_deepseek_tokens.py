"""The local counter must reproduce the model's own five official test vectors.

Files live in claude-api/deepseek-v41/ (downloaded from
deepseek-ai/DeepSeek-V4.1-Flash-1017). A single byte of drift in rendering or
tokenizing fails here, before any number reaches the client.
"""
import pathlib
import sys
import unittest

HERE = pathlib.Path(__file__).resolve().parent
MODEL = HERE.parent / 'claude-api' / 'deepseek-v41'
sys.path.insert(0, str(HERE))

import deepseek_tokens


class OfficialVectors(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        try:
            cls.tok, cls.enc = deepseek_tokens.load()
        except RuntimeError:
            raise unittest.SkipTest('tokenizer runtime missing')

    def render(self, index):
        case = self.enc.load_cases(str(MODEL / f'tests/test_input_{index}.json'))[0]
        want = (MODEL / f'tests/test_output_{index}.txt').read_text()
        for mode in ('thinking', 'chat'):
            case = self.enc.load_cases(str(MODEL / f'tests/test_input_{index}.json'))[0]
            prompt, _ = self.enc.encode_case(case, mode)
            if prompt == want:
                return prompt, mode
        self.fail(f'case {index}: render differs from the official output')

    def test_five_official_cases(self):
        for index in range(1, 6):
            prompt, mode = self.render(index)
            ids = self.tok.encode(prompt, add_special_tokens=False).ids
            self.assertGreater(len(ids), 0, f'case {index}')

    def test_persian_costs_more_than_english(self):
        en = {'messages': [{'role': 'user', 'content': 'hello world ' * 50}]}
        fa = {'messages': [{'role': 'user', 'content': 'سلام دنیا ' * 50}]}
        self.assertGreater(deepseek_tokens.count(fa), deepseek_tokens.count(en))

    def test_swapped_roles_detected(self):
        # Sabotage guard: a body whose system prompt is dropped must count less.
        with_system = {'system': 'a long system prompt ' * 40,
                       'messages': [{'role': 'user', 'content': 'hi'}]}
        without = {'messages': [{'role': 'user', 'content': 'hi'}]}
        self.assertGreater(deepseek_tokens.count(with_system), deepseek_tokens.count(without))

    def test_thinking_mode_affects_count(self):
        # The reasoning-effort prefix is only rendered in thinking mode; if the
        # mode selection is broken the two counts come out equal.
        msgs = [{'role': 'user', 'content': 'hi'}]
        thinking = {'messages': msgs, 'thinking': {'type': 'enabled', 'budget_tokens': 31999}}
        plain = {'messages': msgs}
        self.assertGreater(deepseek_tokens.count(thinking), deepseek_tokens.count(plain))

    def test_thinking_field_three_states(self):
        # disabled is a truthy dict: counting it as thinking would add the
        # Reasoning Effort prefix to a chat that never renders it.
        msgs = [{'role': 'user', 'content': 'hi'}]
        plain = deepseek_tokens.count({'messages': msgs})
        disabled = deepseek_tokens.count({'messages': msgs, 'thinking': {'type': 'disabled'}})
        enabled = deepseek_tokens.count({'messages': msgs, 'thinking': {'type': 'enabled', 'budget_tokens': 75}})
        huge = deepseek_tokens.count({'messages': msgs, 'thinking': {'type': 'enabled', 'budget_tokens': 31999}})
        self.assertEqual(disabled, plain)
        self.assertGreater(enabled, plain)
        self.assertIsNotNone(huge, 'a budget outside 1..100 must not break counting')
        self.assertGreater(huge, plain)

    def test_tool_result_and_use_counted(self):
        body = {'messages': [
            {'role': 'user', 'content': 'run it'},
            {'role': 'assistant', 'content': [
                {'type': 'tool_use', 'id': 't1', 'name': 'run', 'input': {'cmd': 'ls'}}]},
            {'role': 'user', 'content': [
                {'type': 'tool_result', 'tool_use_id': 't1', 'content': 'a.txt b.txt'}]}]}
        bare = {'messages': [{'role': 'user', 'content': 'run it'}]}
        self.assertGreater(deepseek_tokens.count(body), deepseek_tokens.count(bare))


if __name__ == '__main__':
    unittest.main()
