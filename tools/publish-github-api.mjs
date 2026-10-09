/* =============================================================
   tools/publish-github-api.mjs · 通过 GitHub REST API 发布（备用部署通道）
   —— 当网络无法直连 github.com:443 做 git push 时，改用只依赖 api.github.com 的方式
      把当前工作区（git 跟踪的文件）变成一个 commit 推到 main，并开启 GitHub Pages。

   用法：
     gh auth login            # 确保已登录（需要 repo 权限）
     node tools/publish-github-api.mjs [owner/repo]
   ============================================================= */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const API = 'https://api.github.com';
const repoArg = process.argv[2];

function sh(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8', shell: process.platform === 'win32' }).trim();
}

const token = process.env.GITHUB_TOKEN || sh('gh', ['auth', 'token']);
const repo = repoArg || sh('gh', ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner']);
console.log('目标仓库:', repo);

async function api(method, url, body) {
  const res = await fetch(API + url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'dataflow-lab-publisher',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (e) { /* ignore */ }
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status} ${text.slice(0, 400)}`);
  return json;
}

/* 1) 取当前分支头（可能是空仓库） */
let headSha = null;
try {
  const ref = await api('GET', `/repos/${repo}/git/ref/heads/main`);
  headSha = ref.object.sha;
} catch (e) {
  // 空仓库无法创建 blob，先用 Contents API 写入一个占位文件把仓库"激活"
  console.log('仓库为空，先用 Contents API 初始化…');
  await api('PUT', `/repos/${repo}/contents/.nojekyll`, {
    message: 'chore: init repository',
    content: Buffer.from('# DataFlow Lab\n').toString('base64'),
  });
  const ref = await api('GET', `/repos/${repo}/git/ref/heads/main`);
  headSha = ref.object.sha;
}

/* 2) 逐个文件上传 blob */
// core.quotepath=false + -z：避免中文文件名被转义
const files = sh('git', ['-c', 'core.quotepath=false', 'ls-files', '-z']).split('\0').filter(Boolean);
const tree = [];
for (const f of files) {
  const buf = fs.readFileSync(path.resolve(f));
  const blob = await api('POST', `/repos/${repo}/git/blobs`, { content: buf.toString('base64'), encoding: 'base64' });
  tree.push({ path: f.replace(/\\/g, '/'), mode: '100644', type: 'blob', sha: blob.sha });
  console.log(`  + ${f}  (${(buf.length / 1024).toFixed(0)} KB)`);
}

/* 3) 建 tree / commit / 更新 ref */
const newTree = await api('POST', `/repos/${repo}/git/trees`, { tree });
const commit = await api('POST', `/repos/${repo}/git/commits`, {
  message: 'feat: DataFlow Lab 可视化数据分析实验室（13 个 pandas 风格操作的逐步动画演示）',
  tree: newTree.sha,
  parents: headSha ? [headSha] : [],
});
if (headSha) {
  await api('PATCH', `/repos/${repo}/git/refs/heads/main`, { sha: commit.sha, force: true });
} else {
  await api('POST', `/repos/${repo}/git/refs`, { ref: 'refs/heads/main', sha: commit.sha });
}
console.log('提交完成:', commit.sha.slice(0, 8));

/* 4) 开启 GitHub Pages */
try {
  await api('POST', `/repos/${repo}/pages`, { source: { branch: 'main', path: '/' } });
  console.log('GitHub Pages 已开启');
} catch (e) {
  if (/409|already/i.test(e.message)) console.log('GitHub Pages 已存在');
  else console.log('开启 Pages 失败（可在仓库 Settings → Pages 手动开启）：', e.message.slice(0, 200));
}

const [owner, name] = repo.split('/');
console.log(`\n网站地址：https://${owner}.github.io/${name}/`);
console.log('（首次发布需等待 1~2 分钟构建）');
