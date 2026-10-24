import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch
from zipfile import ZipFile

spec = importlib.util.spec_from_file_location('bal_package', Path(__file__).resolve().parents[1] / 'scripts/package.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PackagingTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name) / 'repo'
        self.root.mkdir()
        self.out = self.root.parent / 'archives'
        subprocess.run(['git', 'init', '-q', str(self.root)], check=True)
        self.add('package.json', '{"version":"0.1.2"}')
        self.add('README.md', 'public documentation')
        self.add('skills/break-a-leg/SKILL.md', 'public skill')
        self.add('skills/break-a-leg/references/check.md', 'public check')

    def add(self, name, content):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)
        subprocess.run(['git', '-C', str(self.root), 'add', '--force', '--', name], check=True)

    def test_packages_only_tracked_public_files_and_complete_skill(self):
        (self.root / 'private-review.md').write_text('synthetic private audit')
        (self.root / 'skills/break-a-leg/custom-private.md').write_text('local customization')
        for name in ['.env', 'docs/.env.local', 'debug.log', 'node_modules/vendor/data.txt', '.break-a-leg/review.md', 'upload.pem']:
            self.add(name, 'synthetic excluded content')
        source, skill = module.package(self.root, self.out)
        with ZipFile(source) as archive:
            self.assertEqual(set(archive.namelist()), {
                'break-a-leg/package.json', 'break-a-leg/README.md',
                'break-a-leg/skills/break-a-leg/SKILL.md',
                'break-a-leg/skills/break-a-leg/references/check.md',
            })
        with ZipFile(skill) as archive:
            self.assertEqual(set(archive.namelist()), {'break-a-leg/SKILL.md', 'break-a-leg/references/check.md'})

    def test_existing_second_archive_prevents_any_partial_output(self):
        self.out.mkdir()
        existing = self.out / 'break-a-leg-v0.1.2-skill.zip'
        existing.write_bytes(b'preserve existing archive')
        with self.assertRaises(ValueError):
            module.package(self.root, self.out)
        self.assertEqual(existing.read_bytes(), b'preserve existing archive')
        self.assertFalse((self.out / 'break-a-leg-v0.1.2-source.zip').exists())

    def test_tracked_symlink_is_rejected_without_copying_its_target(self):
        private = self.root.parent / 'private.txt'
        private.write_text('synthetic private data')
        (self.root / 'linked.txt').symlink_to(private)
        subprocess.run(['git', '-C', str(self.root), 'add', 'linked.txt'], check=True)
        with self.assertRaises(ValueError):
            module.package(self.root, self.out)
        self.assertFalse(self.out.exists())

    def test_output_inside_repository_is_rejected(self):
        with self.assertRaises(ValueError):
            module.package(self.root, self.root / 'release')

    def test_extracted_folder_or_nested_checkout_is_not_a_packaging_root(self):
        extracted = self.root.parent / 'extracted'
        extracted.mkdir()
        with self.assertRaises(ValueError):
            module.package(extracted, self.out)
        with self.assertRaises(ValueError):
            module.package(self.root / 'skills/break-a-leg', self.out)

    def test_write_failure_removes_new_partial_archives(self):
        with patch.object(module.ZipFile, 'write', side_effect=OSError('synthetic disk failure')):
            with self.assertRaises(OSError):
                module.package(self.root, self.out)
        self.assertEqual(list(self.out.iterdir()), [])

    def test_unsafe_version_cannot_escape_output_directory(self):
        self.add('package.json', '{"version":"../../unexpected"}')
        with self.assertRaises(ValueError):
            module.package(self.root, self.out)
        self.assertFalse(self.out.exists())


if __name__ == '__main__':
    unittest.main()
