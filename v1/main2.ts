import { Octokit } from "npm:octokit@4.0.2";

// Usage
const octokit = new Octokit({ auth: "PLACEHOLDER_PAT" });

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
}
