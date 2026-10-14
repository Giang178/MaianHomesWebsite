# Scripts

`deployment/` chứa toàn bộ thao tác vòng đời phát hành: capture baseline, provision staging, publish image, deploy worker, switch/rollback blue-green và backup/restore drill.

Thao tác đổi model Ollama trên VM nằm tại `infrastructure/gcp/switch-ollama-model.sh` vì script này vận hành trực tiếp Docker Compose staging.

Chạy script từ root repository để các đường dẫn tương đối luôn nhất quán.
