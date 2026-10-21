#!/usr/bin/env bash
set -euo pipefail

host="${1:?usage: deploy/release.sh user@host}"
engine="${CONTAINER_ENGINE:-podman}"
remote_dir="apps/tasktracker"
images=(localhost/tasktracker-app:latest localhost/tasktracker-web:latest)

cd "$(dirname "$0")/.."
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

"$engine" build --platform linux/amd64 --target app -t "${images[0]}" .
"$engine" build --platform linux/amd64 --target web -t "${images[1]}" .

if [ "$engine" = podman ]; then
	podman save -m --format docker-archive -o "$work/images.tar" "${images[@]}"
else
	docker save -o "$work/images.tar" "${images[@]}"
fi
gzip "$work/images.tar"

ssh "$host" "mkdir -p $remote_dir"
scp "$work/images.tar.gz" docker-compose.yml "$host:$remote_dir/"
ssh "$host" "cd $remote_dir && gunzip -c images.tar.gz | docker load && rm images.tar.gz && docker compose up -d && docker image prune -f"
