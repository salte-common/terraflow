/**
 * Cloud provider detection utility
 * Detects and retrieves cloud provider information
 */

import { execSync } from 'child_process';
import type { CloudInfo } from '../types/context.js';

/**
 * Cloud provider detection utilities
 */
export class CloudUtils {
  /**
   * Detect cloud provider from environment
   * @returns Cloud information
   */
  static async detectCloud(): Promise<CloudInfo> {
    const cloud: CloudInfo = {
      provider: 'none',
    };

    // Check for AWS
    if (process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE || process.env.AWS_REGION) {
      cloud.provider = 'aws';
      cloud.awsRegion = CloudUtils.getAwsRegion();
      try {
        cloud.awsAccountId = await CloudUtils.getAwsAccountId();
      } catch {
        // Account ID fetch failed, continue without it
      }
      return cloud;
    }

    // Check for Azure
    if (process.env.AZURE_CLIENT_ID || process.env.ARM_CLIENT_ID) {
      cloud.provider = 'azure';
      try {
        cloud.azureSubscriptionId = await CloudUtils.getAzureSubscriptionId();
        cloud.azureTenantId = await CloudUtils.getAzureTenantId();
      } catch {
        // Subscription/Tenant ID fetch failed, continue without it
      }
      return cloud;
    }

    // Check for GCP
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GCLOUD_PROJECT) {
      cloud.provider = 'gcp';
      try {
        cloud.gcpProjectId = await CloudUtils.getGcpProjectId();
      } catch {
        // Project ID fetch failed, continue without it
      }
      return cloud;
    }

    return cloud;
  }

  /**
   * Get AWS account ID via `aws sts get-caller-identity`
   * @returns AWS account ID or undefined
   */
  static async getAwsAccountId(): Promise<string | undefined> {
    try {
      const result = execSync('aws sts get-caller-identity --output json', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const identity = JSON.parse(result);
      return identity.Account;
    } catch {
      return undefined;
    }
  }

  /**
   * Get AWS region from environment variables
   * Syncs AWS_REGION and AWS_DEFAULT_REGION
   * Defaults to us-east-1 if not set
   * @returns AWS region
   */
  static getAwsRegion(): string {
    let region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;

    // Sync AWS_REGION and AWS_DEFAULT_REGION
    if (process.env.AWS_REGION && !process.env.AWS_DEFAULT_REGION) {
      process.env.AWS_DEFAULT_REGION = process.env.AWS_REGION;
    } else if (process.env.AWS_DEFAULT_REGION && !process.env.AWS_REGION) {
      process.env.AWS_REGION = process.env.AWS_DEFAULT_REGION;
    }

    // Default to us-east-1 if not set
    if (!region) {
      region = 'us-east-1';
      process.env.AWS_REGION = region;
      process.env.AWS_DEFAULT_REGION = region;
    }

    return region;
  }

  /**
   * Get Azure subscription ID via `az account show`
   * @returns Azure subscription ID or undefined
   */
  static async getAzureSubscriptionId(): Promise<string | undefined> {
    try {
      const result = execSync('az account show --output json', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const account = JSON.parse(result);
      return account.id;
    } catch {
      return undefined;
    }
  }

  /**
   * Get Azure tenant ID via `az account show`
   * @returns Azure tenant ID or undefined
   */
  static async getAzureTenantId(): Promise<string | undefined> {
    try {
      const result = execSync('az account show --output json', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const account = JSON.parse(result);
      return account.tenantId;
    } catch {
      return undefined;
    }
  }

  /**
   * Get GCP project ID via `gcloud config get-value project`
   * @returns GCP project ID or undefined
   */
  static async getGcpProjectId(): Promise<string | undefined> {
    try {
      const result = execSync('gcloud config get-value project', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return result.trim() || undefined;
    } catch {
      return undefined;
    }
  }
}
