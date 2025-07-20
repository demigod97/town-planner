# Debug Town Planner Integration

Debug common issues with the town-planner project integration.

## Usage
Run this command when experiencing issues with:
- Docker containers not starting
- n8n workflows not triggering
- Supabase connection problems
- File upload processing failures
- Frontend-backend communication issues

## Steps

1. **Check Integration Status**
   ```bash
   node claude-tasks/integration-checker.js
   ```

2. **Verify Environment Variables**
   - Check `.env` file exists and has required variables
   - Verify Docker environment variables are set
   - Ensure Supabase keys are correct

3. **Check Docker Services**
   ```bash
   docker ps
   docker logs n8n
   docker logs supabase_kong
   ```

4. **Test Connectivity**
   - n8n: http://localhost:5678
   - Supabase: http://localhost:8000
   - Frontend: http://localhost:5173

5. **Common Solutions**
   - Restart Docker services: `npm run docker:down && npm run docker:up`
   - Clear Docker cache: `docker system prune`
   - Rebuild containers: `docker-compose build --no-cache`
   - Check firewall/port conflicts

## Troubleshooting Checklist

- [ ] All required files exist (docker-compose.yml, .env, etc.)
- [ ] Environment variables are properly set
- [ ] Docker Desktop is running
- [ ] No port conflicts (5678, 8000, 5173)
- [ ] Latest code is pulled and dependencies installed
- [ ] n8n workflows are activated
- [ ] Supabase edge functions are deployed