import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GUARD_PATH = ROOT / "scripts" / "deployment" / "deployment-source-guard.ps1"


class DeploymentSourceGuardContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.guard = GUARD_PATH.read_text(encoding="utf-8")

    def test_source_identity_requires_exact_clean_reviewed_checkout(self):
        self.assertIn("function Assert-DeploymentSourceIdentity", self.guard)
        self.assertIn("^[0-9a-fA-F]{40}$", self.guard)
        self.assertIn("rev-parse HEAD", self.guard)
        self.assertIn("rev-parse --show-toplevel", self.guard)
        self.assertIn("status --porcelain=v1 --untracked-files=all", self.guard)
        self.assertIn("Workspace must be the exact Git repository root", self.guard)
        self.assertIn("Get-VerifiedDeploymentGitState", self.guard)
        self.assertGreaterEqual(self.guard.count("Get-VerifiedDeploymentGitState"), 3)

    def test_manifest_uses_fixed_tracked_non_secret_files(self):
        for relative_path in (
            "backend/Dockerfile",
            "docker-compose.yml",
            "docker-compose.production.yml",
            "docker-compose.staging.yml",
            "frontend/Dockerfile",
            "infrastructure/nginx.production.conf",
            "infrastructure/switch-nginx-upstream.sh",
            "infrastructure/upstreams/blue.conf",
            "infrastructure/upstreams/green.conf",
            "scripts/deployment/deployment-lock.ps1",
            "scripts/deployment/deployment-source-guard.ps1",
            "scripts/deployment/deploy-workers.ps1",
            "scripts/deployment/rollback-blue-green.ps1",
            "scripts/deployment/rollout-blue-green.ps1",
            "scripts/deployment/switch-blue-green.ps1",
        ):
            self.assertIn(f"'{relative_path}'", self.guard)
        self.assertIn("ls-files --error-unmatch -- $relativePath", self.guard)
        self.assertIn("Get-DeploymentFileSha256", self.guard)
        self.assertIn("deployment-source-manifest.sha256", self.guard)
        self.assertIn("critical_manifest_sha256=", self.guard)
        self.assertNotIn(".env.production", self.guard)
        self.assertNotIn(".env.staging", self.guard)

    def test_evidence_is_idempotent_and_never_overwritten(self):
        self.assertIn("function Write-ImmutableDeploymentEvidence", self.guard)
        self.assertIn("[System.IO.FileMode]::CreateNew", self.guard)
        self.assertIn("already exists with different content", self.guard)
        self.assertIn("source guard will not create it", self.guard)

    def test_nginx_targets_are_bound_to_their_named_upstream_blocks(self):
        self.assertIn("$expectedByBlock", self.guard)
        self.assertIn("$actualByBlock", self.guard)
        self.assertIn("upstream $blockName must contain exactly one", self.guard)
        self.assertIn("frontend_target=", self.guard)
        self.assertIn("backend_target=", self.guard)


if __name__ == "__main__":
    unittest.main()
