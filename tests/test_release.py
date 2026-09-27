import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
import tarfile
import tempfile
import threading
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import release


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.source = self.root / "source"
        self.source.mkdir()
        (self.source / "index.html").write_text('<link href="styles.css?v=old"><script src="app.js?v=old"></script>')
        (self.source / "styles.css").write_text("body { color: black; }")
        (self.source / "app.js").write_text("console.log('ok');")
        self.revision = "a" * 40
        self.archive = self.root / "site.tar.gz"
        release.package(self.source, self.archive, self.revision)
        self.site = self.root / "site"
        (self.site / "releases" / "bootstrap").mkdir(parents=True)
        (self.site / "current").symlink_to("releases/bootstrap")

    def test_package_versions_assets_without_editing_source(self):
        with tarfile.open(self.archive) as archive:
            self.assertEqual(sorted(archive.getnames()), sorted(release.FILES))
            html = archive.extractfile("index.html").read().decode()
            self.assertEqual(html.count("?v=" + self.revision), 2)
        self.assertIn("?v=old", (self.source / "index.html").read_text())

    def test_deploy_checks_served_bytes_and_can_be_retried(self):
        handler = functools.partial(QuietHandler, directory=str(self.site / "current"))
        server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            for _ in range(2):
                release.deploy(self.archive, self.site, self.revision, f"http://127.0.0.1:{server.server_port}", attempts=1)
            self.assertEqual((self.site / "current" / "release.txt").read_text().strip(), self.revision)
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

    def test_failed_health_check_restores_previous_release(self):
        with patch.object(release, "check_site", side_effect=RuntimeError("Wrong public content")):
            with self.assertRaises(RuntimeError):
                release.deploy(self.archive, self.site, self.revision, "https://example.com", attempts=1)
        self.assertEqual((self.site / "current").readlink(), Path("releases/bootstrap"))

    def test_origin_check_uses_local_caddy_with_real_tls_hostname(self):
        with tarfile.open(self.archive) as archive:
            stage = self.root / "origin"
            stage.mkdir()
            for name in release.FILES:
                (stage / name).write_bytes(archive.extractfile(name).read())
        def respond(command, **kwargs):
            self.assertIn("skippy.dancelot.dev:443:127.0.0.1", command)
            self.assertNotIn("--insecure", command)
            name = command[-1].split("/")[-1].split("?")[0]
            return type("Response", (), {"stdout": (stage / name).read_bytes()})()
        with patch.object(release.subprocess, "run", side_effect=respond):
            release.check_site("https://skippy.dancelot.dev", stage, origin=True)

    def test_unexpected_archive_files_do_not_change_live_site(self):
        with tarfile.open(self.archive, "w:gz") as archive:
            archive.add(self.source / "app.js", arcname="../app.js")
        with self.assertRaises(ValueError):
            release.deploy(self.archive, self.site, self.revision, "https://example.com", attempts=1)
        self.assertEqual((self.site / "current").readlink(), Path("releases/bootstrap"))


if __name__ == "__main__":
    unittest.main()
