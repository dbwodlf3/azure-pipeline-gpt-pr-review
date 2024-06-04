import * as tl from "azure-pipelines-task-lib";
import { deleteExistingComments } from "./pr";
import { reviewFile } from "./review";
import { getTargetBranchName } from "./utils";
import { filterFilesByPattern, getChangedFiles } from "./git";
import https from "https";
import { ReviewManager } from "./lib/manager";

async function run() {
  try {
    if (tl.getVariable("Build.Reason") !== "PullRequest") {
      tl.setResult(
        tl.TaskResult.Skipped,
        "This task should be run only when the build is triggered from a Pull Request."
      );
      return;
    }

    // params
    const supportSelfSignedCertificate = tl.getBoolInput(
      "support_self_signed_certificate"
    );
    const commentLanguage = tl.getInput("comment_language", true) as
      | "ko"
      | "en";
    const filePattern = tl.getInput("file_pattern");
    const aiApiKey = tl.getInput("api_key", true);
    const aoiEndpoint = tl.getInput("aoi_endpoint", true);
    const aoiInstruction = tl.getInput("aoi_instruction", true);
    const aoiModelResourceId = tl.getInput(
      "aoi_model_resource_id",
      true
    ) as string;
    const aoiTokenLimit = tl.getInput("aoi_token_limit", true);
    const gitPatchLimit = tl.getInput("git_patch_limit", true);

    if (aoiTokenLimit) {
      ReviewManager.reviewOptions.aoi.tokenLimit = parseInt(aoiTokenLimit);
    }
    if (gitPatchLimit) {
      ReviewManager.reviewOptions.git.patchLimit = parseInt(gitPatchLimit);
    }

    // Print out the task infos
    console.log(`Process.env.NODE_ENV=${process.env.NODE_ENV}`);
    console.log(
      `AOI Token Limit: ${ReviewManager.reviewOptions.aoi.tokenLimit}`
    );
    console.log(
      `Git Patch Limit: ${ReviewManager.reviewOptions.git.patchLimit}`
    );

    const httpsAgent = new https.Agent({
      rejectUnauthorized: !supportSelfSignedCertificate,
    });
    let targetBranch = getTargetBranchName();

    if (!aiApiKey) {
      tl.setResult(tl.TaskResult.Failed, "No Api Key provided!");
      return;
    } else if (!aoiEndpoint) {
      tl.setResult(tl.TaskResult.Failed, "Only support Azure AI Service.");
      return;
    } else if (!targetBranch) {
      tl.setResult(tl.TaskResult.Failed, "No target branch found!");
      return;
    }

    let filesNames = await getChangedFiles(targetBranch);

    if (filePattern) {
      filesNames = filterFilesByPattern(filesNames, new RegExp(filePattern));
    }

    // It is sequencial, it is intentional.
    await deleteExistingComments(httpsAgent);
    for (const fileName of filesNames) {
      await reviewFile({
        targetBranch,
        fileName,
        httpsAgent,
        aoi: {
          apiKey: aiApiKey,
          aoiEndpoint,
          aoiModelResourceId: aoiModelResourceId,
          commentLanguage: commentLanguage,
          customInstruction: aoiInstruction,
        },
      });
    }

    console.log(`
    total files: ${filesNames.length}
    total tokens: ${ReviewManager.getTotalUsage()}`);

    tl.setResult(tl.TaskResult.Succeeded, `Pull Request reviewed.`);
  } catch (err: any) {
    tl.setResult(tl.TaskResult.Failed, err.message);
  }
}

run();
