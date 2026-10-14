import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class SingleNodeMongoTopologyContractTests(unittest.TestCase):
    def test_compose_has_one_replica_set_member_and_no_legacy_members(self):
        compose = (ROOT / "docker-compose.yml").read_text(encoding="utf-8")

        self.assertIn("  mongo1:", compose)
        self.assertNotIn("  mongo2:", compose)
        self.assertNotIn("  mongo3:", compose)
        self.assertNotIn("mongo2_data", compose)
        self.assertNotIn("mongo3_data", compose)
        self.assertIn('--wiredTigerCacheSizeGB', compose)
        self.assertIn('members:[{_id:0,host:"mongo1:27017"}]', compose)
        self.assertNotIn('host:"mongo2:27017"', compose)
        self.assertNotIn('host:"mongo3:27017"', compose)
        self.assertIn("db.hello().isWritablePrimary", compose)

    def test_environment_and_staging_deploy_use_the_same_single_node_url(self):
        docker_env = (ROOT / ".env.docker.example").read_text(encoding="utf-8")
        staging_env = (ROOT / ".env.staging.example").read_text(encoding="utf-8")
        deploy = (ROOT / "infrastructure" / "gcp" / "deploy-staging.sh").read_text(
            encoding="utf-8"
        )

        self.assertIn(
            "MONGODB_URL=mongodb://mongo1:27017/maian_homes?replicaSet=rs0",
            docker_env,
        )
        self.assertIn(
            "MONGODB_URL=mongodb://mongo1:27017/maian_staging?replicaSet=rs0",
            staging_env,
        )
        self.assertIn(
            'expected_mongodb_url="mongodb://mongo1:27017/${DATABASE_NAME}?replicaSet=rs0"',
            deploy,
        )
        self.assertIn("for volume in mongo1_data; do", deploy)
        self.assertNotIn("mongo1 mongo2 mongo3", deploy)
        self.assertIn("MONGODB_WIRED_TIGER_CACHE_GB=2", staging_env)
        self.assertIn("UVICORN_WORKERS=2", staging_env)


if __name__ == "__main__":
    unittest.main()