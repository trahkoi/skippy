#!/usr/bin/env python3
"""Package and deploy Skippy using only Python's standard library."""

import argparse
import fcntl
import os
from pathlib import Path
import re
import shutil
import subprocess
import tarfile
import tempfile
import time
from urllib.request import Request, urlopen
from urllib.parse import urlsplit

FILES = ("index.html", "styles.css", "app.js", "release.txt")


def release_id(value):
    if not re.fullmatch(r"[a-f0-9]{40}", value):
        raise ValueError("Release must be a full Git commit SHA")
    return value


def package(source, output, revision):
    release_id(revision)
    subprocess.run(["node", "--check", str(source / "app.js")], check=True)
    with tempfile.TemporaryDirectory() as temporary:
        stage = Path(temporary)
        for name in FILES[:3]:
            shutil.copyfile(source / name, stage / name)
        html = (stage / "index.html").read_text()
        for asset in ("styles.css", "app.js"):
            html, count = re.subn(
                re.escape(asset) + r"(?:\?v=[^\"\s]*)?(?=\")",
                asset + "?v=" + revision,
                html,
            )
            if count != 1:
                raise ValueError(f"Expected one reference to {asset}")
        (stage / "index.html").write_text(html)
        (stage / "release.txt").write_text(revision + "\n")
        with tarfile.open(output, "w:gz") as archive:
            for name in FILES:
                archive.add(stage / name, arcname=name)


def switch(root, target):
    temporary = root / "current.next"
    temporary.unlink(missing_ok=True)
    temporary.symlink_to(target)
    os.replace(temporary, root / "current")


def check_site(url, release, origin=False):
    for name in FILES:
        if origin:
            hostname = urlsplit(url).hostname
            result = subprocess.run(
                ["curl", "--fail", "--silent", "--show-error", "--noproxy", "*", "--max-time", "15",
                 "--resolve", f"{hostname}:443:127.0.0.1",
                 url.rstrip("/") + "/" + name + "?deploy=" + release.name],
                check=True, capture_output=True,
            )
            if result.stdout != (release / name).read_bytes():
                raise RuntimeError(f"Caddy content does not match release: {name}")
            continue
        request = Request(
            url.rstrip("/") + "/" + name + "?deploy=" + release.name,
            headers={"Cache-Control": "no-cache"},
        )
        with urlopen(request, timeout=15) as response:
            if response.status != 200 or response.read() != (release / name).read_bytes():
                raise RuntimeError(f"Public content does not match release: {name}")


def deploy(archive_path, root, revision, url, attempts=3, origin=False):
    release_id(revision)
    # The deployment user owns this directory; Caddy only needs read access.
    with (root / ".deploy.lock").open("w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        current = root / "current"
        if not current.is_symlink() or not current.is_dir():
            raise ValueError("Bootstrap current as a symlink to the existing site first")
        previous = os.readlink(current)
        releases = root / "releases"
        releases.mkdir(exist_ok=True)
        release = releases / revision
        with tempfile.TemporaryDirectory(prefix=".upload-", dir=releases) as temporary:
            stage = Path(temporary)
            with tarfile.open(archive_path, "r:gz") as archive:
                members = archive.getmembers()
                if sorted(m.name for m in members) != sorted(FILES):
                    raise ValueError("Archive must contain exactly the four public files")
                for member in members:
                    if not member.isfile() or member.size > 5_000_000:
                        raise ValueError("Only small regular files are permitted")
                    with archive.extractfile(member) as source:
                        (stage / member.name).write_bytes(source.read())
                    (stage / member.name).chmod(0o644)
            if (stage / "release.txt").read_text() != revision + "\n":
                raise ValueError("Release marker does not match the requested commit")
            if release.exists():
                if any((release / name).read_bytes() != (stage / name).read_bytes() for name in FILES):
                    raise ValueError("A different release already exists for this commit")
            else:
                # Publish the completed directory before switching current.
                stage.chmod(0o755)
                os.rename(stage, release)
        switch(root, "releases/" + revision)
        try:
            for attempt in range(attempts):
                try:
                    check_site(url, release, origin=origin)
                    break
                except Exception:
                    if attempt == attempts - 1:
                        raise
                    time.sleep(3)
        except BaseException:
            switch(root, previous)
            print(f"Health check failed; restored {previous}", flush=True)
            raise
        print(f"Deployed {revision}; previous release: {previous}", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    pack = commands.add_parser("package")
    pack.add_argument("revision")
    pack.add_argument("output", type=Path)
    pack.add_argument("--source", type=Path, default=Path("."))
    publish = commands.add_parser("deploy")
    publish.add_argument("revision")
    publish.add_argument("archive", type=Path)
    publish.add_argument("url")
    publish.add_argument("--root", type=Path, default=Path("/srv/skippy"))
    publish.add_argument("--origin", action="store_true", help="Check local Caddy over verified HTTPS, bypassing the CDN")
    args = parser.parse_args()
    if args.command == "package":
        package(args.source, args.output, args.revision)
    else:
        if not args.url.startswith("https://"):
            parser.error("The production site URL must use HTTPS")
        deploy(args.archive, args.root, args.revision, args.url, origin=args.origin)


if __name__ == "__main__":
    main()
