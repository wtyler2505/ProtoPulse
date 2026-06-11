#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
const outDir = path.resolve(process.cwd(), '.tmp/screenshot-capture-super');
const outFile = path.join(outDir, 'bootstrap.json');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function postJson(url, body, extraHeaders = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
  return res;
}

async function main() {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  const username = `shot-skill-${suffix}`;
  const password = 'ShotSkillPass123!';

  const registerRes = await postJson(`${baseUrl}/api/auth/register`, { username, password });
  let sessionId = null;
  if (registerRes.ok) {
    const data = await registerRes.json();
    sessionId = data?.sessionId || null;
  }

  const loginRes = await postJson(`${baseUrl}/api/auth/login`, { username, password });
  if (loginRes.ok) {
    const data = await loginRes.json();
    sessionId = data?.sessionId || sessionId;
  }

  if (!sessionId) {
    throw new Error('bootstrap failed: no session id from register/login');
  }

  const projectRes = await postJson(
    `${baseUrl}/api/projects`,
    {
      name: `Screenshot Skill Project ${suffix}`,
      description: 'Auto-created for screenshot-capture-super skill run',
    },
    { 'x-session-id': sessionId },
  );

  if (!projectRes.ok) {
    const text = await projectRes.text();
    throw new Error(`project creation failed: ${projectRes.status} ${text}`);
  }

  const project = await projectRes.json();
  if (!project?.id) {
    throw new Error('project creation response missing id');
  }

  const payload = {
    createdAt: new Date().toISOString(),
    baseUrl,
    username,
    sessionId,
    projectId: project.id,
    projectUrl: `${baseUrl}/projects/${project.id}`,
  };

  ensureDir(outDir);
  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2));
  process.stdout.write(`${outFile}\n`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

