import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('bal_install', Path(__file__).resolve().parents[1] / 'scripts/install.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.source = self.root / 'source'
        self.source.mkdir()
        (self.source / 'SKILL.md').write_text('new skill')
        self.dest = self.root / 'config' / 'skills' / 'break-a-leg'

    def test_agent_selects_its_personal_skills_directory(self):
        with patch.object(module.Path, 'home', return_value=self.root):
            with patch.dict(module.os.environ, {}, clear=True):
                self.assertEqual(module.default_skills_dir('claude'), self.root / '.claude' / 'skills')
                self.assertEqual(module.default_skills_dir('codex'), self.root / '.codex' / 'skills')
            with patch.dict(module.os.environ, {'CODEX_HOME': str(self.root / 'codex-home')}, clear=True):
                self.assertEqual(module.default_skills_dir('codex'), self.root / 'codex-home' / 'skills')

    def test_fresh_install_and_no_implicit_overwrite(self):
        self.assertIsNone(module.install(self.source, self.dest))
        with self.assertRaises(ValueError):
            module.install(self.source, self.dest)
        self.assertEqual((self.dest / 'SKILL.md').read_text(), 'new skill')

    def test_update_preserves_user_changes_outside_discovery_directory(self):
        module.install(self.source, self.dest)
        (self.dest / 'custom-note.md').write_text('keep my work')
        (self.dest / 'SKILL.md').write_text('old modified skill')
        backup = module.install(self.source, self.dest, update=True)
        self.assertEqual((backup / 'custom-note.md').read_text(), 'keep my work')
        self.assertEqual((backup / 'SKILL.md').read_text(), 'old modified skill')
        self.assertEqual(backup.parent, self.dest.parent.parent / 'skill-backups')
        self.assertFalse((self.dest / 'custom-note.md').exists())

    def test_copy_failure_leaves_existing_skill_intact(self):
        module.install(self.source, self.dest)
        (self.dest / 'SKILL.md').write_text('original')
        with patch.object(module.shutil, 'copytree', side_effect=OSError('disk failure')):
            with self.assertRaises(OSError):
                module.install(self.source, self.dest, update=True)
        self.assertEqual((self.dest / 'SKILL.md').read_text(), 'original')

    def test_failed_swap_restores_previous_installation(self):
        module.install(self.source, self.dest)
        (self.dest / 'SKILL.md').write_text('original')
        rename = Path.rename

        def fail_payload(path, target):
            if path.name == 'skill':
                raise OSError('simulated swap failure')
            return rename(path, target)

        with patch.object(Path, 'rename', fail_payload):
            with self.assertRaises(OSError):
                module.install(self.source, self.dest, update=True)
        self.assertEqual((self.dest / 'SKILL.md').read_text(), 'original')

    def test_symlink_source_cannot_copy_unrelated_files(self):
        (self.root / 'private.txt').write_text('not part of skill')
        (self.source / 'linked.txt').symlink_to(self.root / 'private.txt')
        with self.assertRaises(ValueError):
            module.install(self.source, self.dest)
        self.assertFalse(self.dest.exists())

    def test_symlink_destination_is_rejected(self):
        self.dest.parent.mkdir(parents=True)
        self.dest.symlink_to(self.source, target_is_directory=True)
        with self.assertRaises(ValueError):
            module.install(self.source, self.dest, update=True)


if __name__ == '__main__':
    unittest.main()
