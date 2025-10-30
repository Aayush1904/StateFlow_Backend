import { Octokit } from '@octokit/rest';
import IntegrationModel, { IntegrationDocument, IntegrationStatus } from '../models/integration.model';
import { NotFoundException, BadRequestException } from '../utils/appError';

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: Array<{ name: string; color: string }>;
  assignee: { login: string; avatar_url: string } | null;
  created_at: string;
  updated_at: string;
  html_url: string;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed' | 'merged';
  user: { login: string; avatar_url: string };
  head: { ref: string; sha: string };
  base: { ref: string; sha: string };
  merged_at: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  review_comments?: number;
  commits?: number;
  additions?: number;
  deletions?: number;
}

export interface GitHubCommit {
  sha: string;
  message: string;
  author: { name: string; email: string; login?: string; avatar_url?: string };
  committer: { name: string; email: string; login?: string; avatar_url?: string };
  date: string;
  url: string;
  html_url: string;
  stats?: { additions: number; deletions: number; total: number };
}

export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  author: { login: string; avatar_url: string };
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  published_at: string | null;
  html_url: string;
  assets_count: number;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  watchers: number;
  open_issues: number;
  default_branch: string;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  html_url: string;
  homepage: string | null;
  topics: string[];
  archived: boolean;
  private: boolean;
}

export interface GitHubContributor {
  login: string;
  id: number;
  avatar_url: string;
  contributions: number;
  type: string;
  html_url: string;
}

export interface GitHubBranch {
  name: string;
  commit: { sha: string; url: string };
  protected: boolean;
}

// Comprehensive GitHub sync - fetches all data types
export const syncGitHubAllDataService = async (
  integrationId: string,
  projectId?: string
): Promise<{
  repository: GitHubRepository;
  issues: GitHubIssue[];
  pullRequests: GitHubPullRequest[];
  commits: GitHubCommit[];
  releases: GitHubRelease[];
  contributors: GitHubContributor[];
  branches: GitHubBranch[];
  synced: {
    issues: number;
    pullRequests: number;
    commits: number;
    releases: number;
    contributors: number;
    branches: number;
  };
}> => {
  const { integration, accessToken, organization, repository } = await getGitHubIntegration(integrationId);

  try {
    // Fetch all data in parallel
    const [
      repositoryData,
      issuesData,
      pullRequestsData,
      commitsData,
      releasesData,
      contributorsData,
      branchesData,
    ] = await Promise.all([
      getGitHubRepositoryService(integrationId),
      syncGitHubIssuesService(integrationId, projectId).catch(() => ({ issues: [], synced: 0 })),
      getGitHubPullRequestsService(integrationId, 'all').catch(() => ({ pullRequests: [], count: 0 })),
      getGitHubCommitsService(integrationId, undefined, 30).catch(() => ({ commits: [], count: 0 })),
      getGitHubReleasesService(integrationId, 30).catch(() => ({ releases: [], count: 0 })),
      getGitHubContributorsService(integrationId).catch(() => ({ contributors: [], count: 0 })),
      getGitHubBranchesService(integrationId).catch(() => ({ branches: [], count: 0 })),
    ]);

    // Update integration metadata
    integration.metadata = {
      ...integration.metadata,
      lastSyncAt: new Date(),
      syncStatus: 'success',
      lastSyncCount: issuesData.synced + pullRequestsData.count,
      syncDetails: {
        issues: issuesData.synced,
        pullRequests: pullRequestsData.count,
        commits: commitsData.count,
        releases: releasesData.count,
        contributors: contributorsData.count,
        branches: branchesData.count,
      },
    };
    integration.status = IntegrationStatus.ACTIVE;
    await integration.save();

    return {
      repository: repositoryData.repository,
      issues: issuesData.issues,
      pullRequests: pullRequestsData.pullRequests,
      commits: commitsData.commits,
      releases: releasesData.releases,
      contributors: contributorsData.contributors,
      branches: branchesData.branches,
      synced: {
        issues: issuesData.synced,
        pullRequests: pullRequestsData.count,
        commits: commitsData.count,
        releases: releasesData.count,
        contributors: contributorsData.count,
        branches: branchesData.count,
      },
    };
  } catch (error: any) {
    // Update integration with error status
    integration.metadata = {
      ...integration.metadata,
      lastSyncAt: new Date(),
      syncStatus: 'error',
      errorMessage: error.message || 'Failed to sync GitHub data',
    };
    integration.status = IntegrationStatus.ERROR;
    await integration.save();

    throw new BadRequestException(
      `Failed to sync GitHub data: ${error.message || 'Unknown error'}`
    );
  }
};

// Legacy sync - issues only (for backward compatibility)
export const syncGitHubIssuesService = async (
  integrationId: string,
  projectId?: string
): Promise<{ issues: GitHubIssue[]; synced: number }> => {
  const integration = await IntegrationModel.findById(integrationId);
  if (!integration) {
    throw new NotFoundException('Integration not found');
  }

  if (integration.type !== 'github') {
    throw new BadRequestException('Integration is not a GitHub integration');
  }

  const { accessToken, organization, repository } = integration.config;

  if (!accessToken) {
    throw new BadRequestException('GitHub access token is missing');
  }

  if (!organization || !repository) {
    throw new BadRequestException('GitHub organization and repository are required');
  }

  try {
    const octokit = new Octokit({
      auth: accessToken,
    });

    // Fetch issues from GitHub
    const { data: issues } = await octokit.rest.issues.listForRepo({
      owner: organization,
      repo: repository,
      state: 'all',
      per_page: 100,
    });

    // Transform GitHub issues to our format
    const formattedIssues: GitHubIssue[] = issues
      .filter((issue) => !issue.pull_request) // Exclude pull requests
      .map((issue) => ({
        id: issue.id,
        number: issue.number,
        title: issue.title,
        body: issue.body || '',
        state: issue.state as 'open' | 'closed',
        labels: issue.labels.map((label: any) => ({
          name: typeof label === 'string' ? label : label.name,
          color: typeof label === 'string' ? '' : label.color || '',
        })),
        assignee: issue.assignee
          ? {
              login: issue.assignee.login,
              avatar_url: issue.assignee.avatar_url,
            }
          : null,
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        html_url: issue.html_url,
      }));

    // Update integration metadata
    integration.metadata = {
      ...integration.metadata,
      lastSyncAt: new Date(),
      syncStatus: 'success',
      lastSyncCount: formattedIssues.length,
    };

    await integration.save();

    return {
      issues: formattedIssues,
      synced: formattedIssues.length,
    };
  } catch (error: any) {
    // Update integration with error status
    integration.metadata = {
      ...integration.metadata,
      lastSyncAt: new Date(),
      syncStatus: 'error',
      errorMessage: error.message || 'Failed to sync GitHub issues',
    };
    integration.status = IntegrationStatus.ERROR;
    await integration.save();

    throw new BadRequestException(
      `Failed to sync GitHub issues: ${error.message || 'Unknown error'}`
    );
  }
};

export const createGitHubIssueService = async (
  integrationId: string,
  body: {
    title: string;
    body?: string;
    labels?: string[];
    assignee?: string;
  }
): Promise<{ issue: GitHubIssue }> => {
  const integration = await IntegrationModel.findById(integrationId);
  if (!integration) {
    throw new NotFoundException('Integration not found');
  }

  const { accessToken, organization, repository } = integration.config;

  if (!accessToken || !organization || !repository) {
    throw new BadRequestException('GitHub integration is not properly configured');
  }

  try {
    const octokit = new Octokit({
      auth: accessToken,
    });

    const { data: issue } = await octokit.rest.issues.create({
      owner: organization,
      repo: repository,
      title: body.title,
      body: body.body || '',
      labels: body.labels,
      assignees: body.assignee ? [body.assignee] : undefined,
    });

    const formattedIssue: GitHubIssue = {
      id: issue.id,
      number: issue.number,
      title: issue.title,
      body: issue.body || '',
      state: issue.state as 'open' | 'closed',
      labels: issue.labels.map((label: any) => ({
        name: typeof label === 'string' ? label : label.name,
        color: typeof label === 'string' ? '' : label.color || '',
      })),
      assignee: issue.assignee
        ? {
            login: issue.assignee.login,
            avatar_url: issue.assignee.avatar_url,
          }
        : null,
      created_at: issue.created_at,
      updated_at: issue.updated_at,
      html_url: issue.html_url,
    };

    return { issue: formattedIssue };
  } catch (error: any) {
    throw new BadRequestException(
      `Failed to create GitHub issue: ${error.message || 'Unknown error'}`
    );
  }
};

// Helper function to get Octokit instance
const getOctokit = (accessToken: string) => {
  return new Octokit({ auth: accessToken });
};

// Helper function to get integration and validate
const getGitHubIntegration = async (integrationId: string) => {
  const integration = await IntegrationModel.findById(integrationId);
  if (!integration) {
    throw new NotFoundException('Integration not found');
  }

  if (integration.type !== 'github') {
    throw new BadRequestException('Integration is not a GitHub integration');
  }

  const { accessToken, organization, repository } = integration.config;

  if (!accessToken) {
    throw new BadRequestException('GitHub access token is missing');
  }

  if (!organization || !repository) {
    throw new BadRequestException('GitHub organization and repository are required');
  }

  return { integration, accessToken, organization, repository };
};

// Get Repository Info
export const getGitHubRepositoryService = async (
  integrationId: string
): Promise<{ repository: GitHubRepository }> => {
  const { accessToken, organization, repository } = await getGitHubIntegration(integrationId);

  try {
    const octokit = getOctokit(accessToken);
    const { data: repo } = await octokit.rest.repos.get({
      owner: organization,
      repo: repository,
    });

    const formattedRepo: GitHubRepository = {
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description,
      language: repo.language,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      watchers: repo.watchers_count,
      open_issues: repo.open_issues_count,
      default_branch: repo.default_branch,
      created_at: repo.created_at,
      updated_at: repo.updated_at,
      pushed_at: repo.pushed_at,
      html_url: repo.html_url,
      homepage: repo.homepage,
      topics: repo.topics || [],
      archived: repo.archived,
      private: repo.private,
    };

    return { repository: formattedRepo };
  } catch (error: any) {
    throw new BadRequestException(
      `Failed to fetch repository info: ${error.message || 'Unknown error'}`
    );
  }
};

// Get Pull Requests
export const getGitHubPullRequestsService = async (
  integrationId: string,
  state: 'open' | 'closed' | 'all' = 'all'
): Promise<{ pullRequests: GitHubPullRequest[]; count: number }> => {
  const { accessToken, organization, repository } = await getGitHubIntegration(integrationId);

  try {
    const octokit = getOctokit(accessToken);
    const { data: pullRequests } = await octokit.rest.pulls.list({
      owner: organization,
      repo: repository,
      state,
      per_page: 100,
    });

    const formattedPRs: GitHubPullRequest[] = await Promise.all(
      pullRequests.map(async (pr) => {
        try {
          const { data: prDetails } = await octokit.rest.pulls.get({
            owner: organization,
            repo: repository,
            pull_number: pr.number,
          });

          return {
            id: pr.id,
            number: pr.number,
            title: pr.title,
            body: pr.body || '',
            state: pr.state === 'merged' ? 'merged' : (pr.state as 'open' | 'closed'),
            user: {
              login: pr.user?.login || '',
              avatar_url: pr.user?.avatar_url || '',
            },
            head: {
              ref: pr.head.ref,
              sha: pr.head.sha,
            },
            base: {
              ref: pr.base.ref,
              sha: pr.base.sha,
            },
            merged_at: prDetails.merged_at,
            created_at: pr.created_at,
            updated_at: pr.updated_at,
            html_url: pr.html_url,
            review_comments: prDetails.review_comments,
            commits: prDetails.commits,
            additions: prDetails.additions,
            deletions: prDetails.deletions,
          };
        } catch {
          // Fallback if detailed fetch fails
          return {
            id: pr.id,
            number: pr.number,
            title: pr.title,
            body: pr.body || '',
            state: pr.state as 'open' | 'closed',
            user: {
              login: pr.user?.login || '',
              avatar_url: pr.user?.avatar_url || '',
            },
            head: {
              ref: pr.head.ref,
              sha: pr.head.sha,
            },
            base: {
              ref: pr.base.ref,
              sha: pr.base.sha,
            },
            merged_at: null,
            created_at: pr.created_at,
            updated_at: pr.updated_at,
            html_url: pr.html_url,
          };
        }
      })
    );

    return {
      pullRequests: formattedPRs,
      count: formattedPRs.length,
    };
  } catch (error: any) {
    throw new BadRequestException(
      `Failed to fetch pull requests: ${error.message || 'Unknown error'}`
    );
  }
};

// Get Commits
export const getGitHubCommitsService = async (
  integrationId: string,
  branch?: string,
  perPage: number = 30
): Promise<{ commits: GitHubCommit[]; count: number }> => {
  const { accessToken, organization, repository } = await getGitHubIntegration(integrationId);

  try {
    const octokit = getOctokit(accessToken);
    const { data: commits } = await octokit.rest.repos.listCommits({
      owner: organization,
      repo: repository,
      sha: branch,
      per_page: perPage,
    });

    const formattedCommits: GitHubCommit[] = await Promise.all(
      commits.map(async (commit) => {
        try {
          const { data: commitDetails } = await octokit.rest.repos.getCommit({
            owner: organization,
            repo: repository,
            ref: commit.sha,
          });

          return {
            sha: commit.sha,
            message: commit.commit.message,
            author: {
              name: commit.commit.author?.name || '',
              email: commit.commit.author?.email || '',
              login: commit.author?.login,
              avatar_url: commit.author?.avatar_url,
            },
            committer: {
              name: commit.commit.committer?.name || '',
              email: commit.commit.committer?.email || '',
              login: commit.committer?.login,
              avatar_url: commit.committer?.avatar_url,
            },
            date: commit.commit.author?.date || commit.commit.committer?.date || '',
            url: commit.url,
            html_url: commit.html_url,
            stats: commitDetails.stats
              ? {
                  additions: commitDetails.stats.additions ?? 0,
                  deletions: commitDetails.stats.deletions ?? 0,
                  total: commitDetails.stats.total ?? 0,
                }
              : undefined,
          };
        } catch {
          return {
            sha: commit.sha,
            message: commit.commit.message,
            author: {
              name: commit.commit.author?.name || '',
              email: commit.commit.author?.email || '',
              login: commit.author?.login,
              avatar_url: commit.author?.avatar_url,
            },
            committer: {
              name: commit.commit.committer?.name || '',
              email: commit.commit.committer?.email || '',
              login: commit.committer?.login,
              avatar_url: commit.committer?.avatar_url,
            },
            date: commit.commit.author?.date || commit.commit.committer?.date || '',
            url: commit.url,
            html_url: commit.html_url,
          };
        }
      })
    );

    return {
      commits: formattedCommits,
      count: formattedCommits.length,
    };
  } catch (error: any) {
    throw new BadRequestException(
      `Failed to fetch commits: ${error.message || 'Unknown error'}`
    );
  }
};

// Get Releases
export const getGitHubReleasesService = async (
  integrationId: string,
  perPage: number = 30
): Promise<{ releases: GitHubRelease[]; count: number }> => {
  const { accessToken, organization, repository } = await getGitHubIntegration(integrationId);

  try {
    const octokit = getOctokit(accessToken);
    const { data: releases } = await octokit.rest.repos.listReleases({
      owner: organization,
      repo: repository,
      per_page: perPage,
    });

    const formattedReleases: GitHubRelease[] = releases.map((release) => ({
      id: release.id,
      tag_name: release.tag_name,
      name: release.name || release.tag_name,
      body: release.body || '',
      author: {
        login: release.author?.login || '',
        avatar_url: release.author?.avatar_url || '',
      },
      draft: release.draft,
      prerelease: release.prerelease,
      created_at: release.created_at,
      published_at: release.published_at,
      html_url: release.html_url,
      assets_count: release.assets.length,
    }));

    return {
      releases: formattedReleases,
      count: formattedReleases.length,
    };
  } catch (error: any) {
    throw new BadRequestException(
      `Failed to fetch releases: ${error.message || 'Unknown error'}`
    );
  }
};

// Get Contributors
export const getGitHubContributorsService = async (
  integrationId: string
): Promise<{ contributors: GitHubContributor[]; count: number }> => {
  const { accessToken, organization, repository } = await getGitHubIntegration(integrationId);

  try {
    const octokit = getOctokit(accessToken);
    const { data: contributors } = await octokit.rest.repos.listContributors({
      owner: organization,
      repo: repository,
      per_page: 100,
    });

    const formattedContributors: GitHubContributor[] = contributors
      .filter((contributor) => contributor.type === 'User' && contributor.login) // Filter out bots and invalid entries
      .map((contributor) => ({
        login: contributor.login || '',
        id: contributor.id || 0,
        avatar_url: contributor.avatar_url || '',
        contributions: contributor.contributions,
        type: contributor.type,
        html_url: contributor.html_url || '',
      }));

    return {
      contributors: formattedContributors,
      count: formattedContributors.length,
    };
  } catch (error: any) {
    throw new BadRequestException(
      `Failed to fetch contributors: ${error.message || 'Unknown error'}`
    );
  }
};

// Get Branches
export const getGitHubBranchesService = async (
  integrationId: string
): Promise<{ branches: GitHubBranch[]; count: number }> => {
  const { accessToken, organization, repository } = await getGitHubIntegration(integrationId);

  try {
    const octokit = getOctokit(accessToken);
    const { data: branches } = await octokit.rest.repos.listBranches({
      owner: organization,
      repo: repository,
      per_page: 100,
    });

    const formattedBranches: GitHubBranch[] = branches.map((branch) => ({
      name: branch.name,
      commit: {
        sha: branch.commit.sha,
        url: branch.commit.url,
      },
      protected: branch.protected || false,
    }));

    return {
      branches: formattedBranches,
      count: formattedBranches.length,
    };
  } catch (error: any) {
    throw new BadRequestException(
      `Failed to fetch branches: ${error.message || 'Unknown error'}`
    );
  }
};

