#!/usr/bin/env python3
"""Upload a release over verified SSH and run its activation on the VM."""

import os
from pathlib import Path
import re
import shlex
import subprocess
import tempfile
from urllib.parse import urlsplit

from release import package, release_id


def main():
    required = ("DEPLOY_HOST", "DEPLOY_USER", "DEPLOY_SSH_KEY", "DEPLOY_KNOWN_HOSTS", "SITE_URL", "GITHUB_SHA")
    for name in required:
        if not os.environ.get(name):
            raise ValueError(f"Missing {name}")
    host = os.environ["DEPLOY_HOST"]
    user = os.environ["DEPLOY_USER"]
    port = os.environ.get("DEPLOY_PORT") or "22"
    if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9.-]*", host):
        raise ValueError("DEPLOY_HOST must be a hostname or IPv4 address")
    if not re.fullmatch(r"[a-z_][a-z0-9_-]*", user):
        raise ValueError("Invalid DEPLOY_USER")
    if not port.isdigit() or not 1 <= int(port) <= 65535:
        raise ValueError("Invalid DEPLOY_PORT")
    url = os.environ["SITE_URL"]
    parsed = urlsplit(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.path not in ("", "/") or parsed.query or parsed.fragment or parsed.username:
        raise ValueError("SITE_URL must be the HTTPS origin, e.g. https://skippy.example.com")
    revision = release_id(os.environ["GITHUB_SHA"])
    with tempfile.TemporaryDirectory(prefix="skippy-deploy-") as temporary:
        work = Path(temporary)
        key = work / "key"
        key.write_text(os.environ["DEPLOY_SSH_KEY"].rstrip() + "\n")
        key.chmod(0o600)
        known_hosts = work / "known_hosts"
        known_hosts.write_text(os.environ["DEPLOY_KNOWN_HOSTS"].rstrip() + "\n")
        archive = work / "site.tar.gz"
        package(Path("."), archive, revision)
        options = ["-i", str(key), "-o", "IdentitiesOnly=yes", "-o", "BatchMode=yes",
                   "-o", "StrictHostKeyChecking=yes", "-o", f"UserKnownHostsFile={known_hosts}",
                   "-o", "ConnectTimeout=15", "-o", "ServerAliveInterval=15", "-o", "ServerAliveCountMax=4"]
        destination = f"{user}@{host}"
        ssh = ["ssh", *options, "-p", port, destination]
        remote = ".skippy-upload-" + work.name
        subprocess.run([*ssh, shlex.join(["mkdir", "-m", "700", remote])], check=True)
        try:
            subprocess.run(["scp", *options, "-P", port, str(archive), "scripts/release.py",
                            f"{destination}:{remote}/"], check=True)
            command = ["python3", f"{remote}/release.py", "deploy", revision, f"{remote}/site.tar.gz", url, "--origin"]
            subprocess.run([*ssh, shlex.join(command)], check=True)
        finally:
            subprocess.run([*ssh, shlex.join(["rm", "-rf", "--", remote])], check=False)


if __name__ == "__main__":
    main()
