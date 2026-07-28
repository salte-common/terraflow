/**
 * Integration tests for CLI argument passthrough to Terraform
 */

import { execFileSync } from 'child_process';
import path from 'path';

describe('CLI terraform argument passthrough', () => {
  const cli = path.join(__dirname, '../../dist/index.js');

  const runCli = (args: string[]): { stdout: string; stderr: string; status: number | null } => {
    try {
      const stdout = execFileSync('node', [cli, ...args], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { stdout, stderr: '', status: 0 };
    } catch (error) {
      const execError = error as { stdout?: string; stderr?: string; status?: number | null };
      return {
        stdout: execError.stdout?.toString() || '',
        stderr: execError.stderr?.toString() || '',
        status: execError.status ?? null,
      };
    }
  };

  it('should accept -target after apply without requiring -- separator', () => {
    const { stderr } = runCli(['apply', '-target', 'aws_dynamodb_table.carriers', '--dry-run']);
    expect(stderr).not.toContain("unknown option '-target'");
  });

  it('should accept --auto-approve after apply', () => {
    const { stderr } = runCli(['apply', '--auto-approve', '--dry-run']);
    expect(stderr).not.toContain("unknown option '--auto-approve'");
  });

  it('should accept --target after plan', () => {
    const { stderr } = runCli(['plan', '--target', 'aws_dynamodb_table.carriers', '--dry-run']);
    expect(stderr).not.toContain("unknown option '--target'");
  });
});
