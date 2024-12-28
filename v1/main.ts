import { Octokit } from "npm:octokit@4.0.2";

// Usage
const organization = "PLACEHOLDER_ORG"; // Replace with your organization
const user = "PLACEHOLDER_USER"; // Replace with the username
const octokit = new Octokit({ auth: "PLACEHOLDER_PAT" });

async function getReposWithWriteAccess(org: string) {
  try {
    const repos = [];
    let page = 1;

    while (true) {
      const { data, headers } = await octokit.rest.repos.listForOrg({
        org,
        type: "all", // Fetch all repos in the organization
        per_page: 100, // Fetch 100 repos per page
        page,
      });

      repos.push(...data);

      // Check if there is a 'next' page
      const linkHeader = headers.link;
      const hasNextPage = linkHeader && linkHeader.includes('rel="next"');

      if (!hasNextPage) {
        break;
      }

      page++;
    }

    const reposWithWriteAccess = [];

    for (const repo of repos) {
      if (
        repo?.role_name === "write" ||
        repo?.role_name === "admin" ||
        repo?.permissions?.push
      ) {
        reposWithWriteAccess.push(repo);
      }
    }

    return reposWithWriteAccess;
  } catch (error) {
    console.error("Error fetching repositories:", error);
  }
}

const repoPrs: Record<string, unknown[]> = {};

async function getUserPRsForRepo(
  owner: string,
  repo: string,
  username: string
) {
  const prs = [];
  let page = 1;

  if (!repoPrs[repo]) {
    repoPrs[repo] = [];

    while (true) {
      console.log("fetching PRs for repo:", repo, "page:", page);
      const { data, headers } = await octokit.rest.pulls.list({
        owner,
        repo,
        state: "all", // Fetch open, closed, and merged PRs
        per_page: 100, // Maximum number of results per page
        page,
      });

      repoPrs[repo].push(...data);

      // Check if there is a 'next' page
      const linkHeader = headers.link;
      const hasNextPage = linkHeader && linkHeader.includes('rel="next"');

      if (!hasNextPage) {
        break;
      }

      page++;
    }
  }

  // Filter PRs by the author (user who created the PR)
  const userPRs = repoPrs[repo].filter((pr) => pr?.user?.login === username);
  prs.push(...userPRs);

  return prs;
}

async function getPRApprovals(
  owner: string,
  repo: string,
  pull_number: number
) {
  try {
    const { data: reviews } = await octokit.rest.pulls.listReviews({
      owner,
      repo,
      pull_number,
    });

    // Filter reviews to find those that approved the PR
    const approvals = reviews.filter((review) => review.state === "APPROVED");

    return approvals.map((approval) => ({
      user: approval?.user?.login,
      submitted_at: approval.submitted_at,
    }));
  } catch (error) {
    console.error("Error fetching PR approvals:", error);
    return [];
  }
}

async function updateRecievedApprovalsCount(
  userApprovalMap: Record<string, number>,
  prs: { number: number }[],
  repoName: string
) {
  for (const pr of prs) {
    const approvals = await getPRApprovals(organization, repoName, pr?.number);
    for (const approval of approvals) {
      if (!approval.user) {
        continue;
      }
      if (!userApprovalMap[approval.user]) {
        userApprovalMap[approval.user] = 0;
      }
      userApprovalMap[approval.user] = userApprovalMap[approval.user] + 1;
    }
  }
}

// Learn more at https://deno.land/manual/examples/module_metadata#concepts
if (import.meta.main) {
  const { data } = await octokit.rest.users.getAuthenticated();
  console.log("Hello, %s", data.login);

  const { data: rateLimit } = await octokit.rest.rateLimit.get();

  const coreRateLimit = rateLimit.rate;
  const searchRateLimit = rateLimit.resources.search;

  console.log("Core Rate Limit:");
  console.log(`- Limit: ${coreRateLimit.limit}`);
  console.log(`- Remaining: ${coreRateLimit.remaining}`);
  console.log(`- Resets at: ${new Date(coreRateLimit.reset * 1000)}`);

  console.log("Search Rate Limit:");
  console.log(`- Limit: ${searchRateLimit.limit}`);
  console.log(`- Remaining: ${searchRateLimit.remaining}`);
  console.log(`- Resets at: ${new Date(searchRateLimit.reset * 1000)}`);

  if (coreRateLimit.remaining < 1000) {
    console.warn(
      "Approaching rate limit. I'm going to skip to protect your account."
    );
  } else {
    const startTime = new Date();
    console.log("Github PR Stats parsing start:", startTime);

    const recievedApprovalsCount: Record<string, Record<string, number>> = {
      [user]: {},
    };

    const repos = (await getReposWithWriteAccess(organization)) || [];
    for (const repo of repos) {
      const prs = await getUserPRsForRepo(organization, repo?.name, user);
      await updateRecievedApprovalsCount(
        recievedApprovalsCount[user],
        prs,
        repo?.name
      );
    }
    const sortedEntries = Object.entries(recievedApprovalsCount[user]).sort(
      ([, valueA], [, valueB]) => valueB - valueA
    );
    recievedApprovalsCount[user] = Object.fromEntries(sortedEntries);

    console.log(
      "repos parsed:",
      repos.map((repo) => repo.name)
    );
    console.log("repos.length:", repos.length);
    console.log("recievedApprovalsCount", recievedApprovalsCount);

    const endTime = new Date();
    console.log("Github PR Stats parsing end:", startTime);
    console.log("Time taken:", endTime.getTime() - startTime.getTime(), "ms");
    const { data: rateLimit } = await octokit.rest.rateLimit.get();
    const coreRateLimit = rateLimit.rate;
    console.log(`- Remaining: ${coreRateLimit.remaining}`);
    console.log(`- Resets at: ${new Date(coreRateLimit.reset * 1000)}`);
  }
}
