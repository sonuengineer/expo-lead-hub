# terminal 1
cd f:\Akkii; pnpm dev            # backend :4000
# terminal 2
cd f:\Akkii; pnpm dev:frontend   # frontend :3000

cd f:\Akkii

# 1. Database (Docker Desktop must be running)
docker compose up -d postgres
pnpm db:push
pnpm db:seed

# 2. Run both apps
pnpm dev:all



Get-NetTCPConnection -LocalPort 4000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
