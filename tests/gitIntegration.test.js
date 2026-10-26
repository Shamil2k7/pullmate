import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import GitService from '../electron/gitService.cjs';

describe('GitService Integration with Local Repositories', () => {
  let tempDir;
  let gitService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pullmate-git-test-'));
    gitService = new GitService();

    // Initialize an isolated git repository
    execSync('git init', { cwd: tempDir });
    execSync('git config user.email "test@pullmate.app"', { cwd: tempDir });
    execSync('git config user.name "PullMate Test"', { cwd: tempDir });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('validates a real local git repository', async () => {
    const validation = await gitService.validateLocalFolder(tempDir);
    expect(validation.isValid).toBe(true);
    expect(validation.isRepo).toBe(true);
    expect(path.normalize(validation.rootPath).toLowerCase()).toBe(path.normalize(tempDir).toLowerCase());
  });

  it('detects clean vs uncommitted working trees', async () => {
    // Commit initial file
    const readmePath = path.join(tempDir, 'README.md');
    fs.writeFileSync(readmePath, '# PullMate Test Repo\n');
    execSync('git add .', { cwd: tempDir });
    execSync('git commit -m "Initial commit"', { cwd: tempDir });

    const cleanCheck = await gitService.checkWorkingTree(tempDir);
    expect(cleanCheck.isClean).toBe(true);
    expect(cleanCheck.changedCount).toBe(0);

    // Modify file without committing
    fs.appendFileSync(readmePath, 'Uncommitted change\n');
    const dirtyCheck = await gitService.checkWorkingTree(tempDir);
    expect(dirtyCheck.isClean).toBe(false);
    expect(dirtyCheck.changedCount).toBe(1);
  });

  it('blocks safePull when uncommitted changes exist', async () => {
    const readmePath = path.join(tempDir, 'README.md');
    fs.writeFileSync(readmePath, 'Initial\n');
    execSync('git add .', { cwd: tempDir });
    execSync('git commit -m "Init"', { cwd: tempDir });

    // Create untracked or modified file
    fs.writeFileSync(path.join(tempDir, 'scratch.txt'), 'Modified work');

    await expect(gitService.safePull(tempDir)).rejects.toThrow(/uncommitted changes/);
  });

  it('rejects nonexistent directories safely', async () => {
    const fakePath = path.join(tempDir, 'nonexistent_subfolder');
    const validation = await gitService.validateLocalFolder(fakePath);
    expect(validation.isRepo).toBe(false);
    expect(validation.error).toMatch(/does not exist/);
  });

  it('allows re-entrant withLock calls without deadlocking', async () => {
    const result = await gitService.withLock(tempDir, async () => {
      // Nested withLock on the same repo
      return await gitService.withLock(tempDir, async () => {
        return 're-entrant success';
      });
    });
    expect(result).toBe('re-entrant success');
  });

  it('successfully fast-forwards new commits from remote upstream without deadlocking', async () => {
    // 1. Create a bare remote repository
    const bareDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pullmate-bare-remote-'));
    execSync('git init --bare', { cwd: bareDir });

    try {
      // 2. Set bare remote as origin in tempDir and push initial commit
      const readmePath = path.join(tempDir, 'README.md');
      fs.writeFileSync(readmePath, '# Test Repo\n');
      execSync('git add .', { cwd: tempDir });
      execSync('git commit -m "Initial commit"', { cwd: tempDir });
      execSync(`git remote add origin "${bareDir}"`, { cwd: tempDir });
      execSync('git push -u origin HEAD', { cwd: tempDir });

      // 3. Test safePull when already up to date (this previously deadlocked!)
      const upToDateResult = await gitService.safePull(tempDir);
      expect(upToDateResult.success).toBe(true);
      expect(upToDateResult.message).toMatch(/Already up to date/);

      // 4. Clone to a second working dir and push a new commit to remote
      const cloneDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pullmate-second-clone-'));
      try {
        execSync(`git clone "${bareDir}" "${cloneDir}"`);
        execSync('git config user.email "second@pullmate.app"', { cwd: cloneDir });
        execSync('git config user.name "Second User"', { cwd: cloneDir });

        fs.writeFileSync(path.join(cloneDir, 'remote-change.txt'), 'Hello from remote\n');
        execSync('git add .', { cwd: cloneDir });
        execSync('git commit -m "Add remote change"', { cwd: cloneDir });
        execSync('git push origin HEAD', { cwd: cloneDir });

        // 5. In tempDir, run safePull and verify fast-forward pull works!
        const pullResult = await gitService.safePull(tempDir);
        expect(pullResult.success).toBe(true);
        expect(fs.existsSync(path.join(tempDir, 'remote-change.txt'))).toBe(true);
        expect(fs.readFileSync(path.join(tempDir, 'remote-change.txt'), 'utf-8').trim()).toBe('Hello from remote');
        expect(pullResult.status.status).toBe('up_to_date');
        expect(pullResult.status.behindCount).toBe(0);
      } finally {
        if (fs.existsSync(cloneDir)) {
          fs.rmSync(cloneDir, { recursive: true, force: true });
        }
      }
    } finally {
      if (fs.existsSync(bareDir)) {
        fs.rmSync(bareDir, { recursive: true, force: true });
      }
    }
  });
});
