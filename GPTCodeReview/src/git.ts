import { SimpleGitOptions, SimpleGit, simpleGit } from "simple-git";
import * as tl from "azure-pipelines-task-lib";
import binaryExtensions from "binary-extensions";
import { getFileExtension } from "./utils";

const baseDir = (() => {
  let result = "";

  if (process.env.NODE_ENV != "test") {
    result = `${tl.getVariable("System.DefaultWorkingDirectory")}`;
  }
  return result;
})();

const gitOptions: Partial<SimpleGitOptions> = {
  baseDir: baseDir,
  binary: "git",
};

export const git: SimpleGit = simpleGit(gitOptions);

export async function getChangedFiles(
  targetBranch: string,
  inputGit?: SimpleGit
) {
  const __git = inputGit || git;
  await __git.addConfig("core.pager", "cat");
  await __git.addConfig("core.quotepath", "false");
  await __git.fetch();

  console.log("targetBranch ::= ", targetBranch);

  const diffs = await __git.diff([
    targetBranch,
    "--name-only",
    "--diff-filter=AMD",
  ]);
  const files = diffs.split("\n").filter((line) => line.trim().length > 0);
  const nonBinaryFiles = files.filter(
    (file) => !binaryExtensions.includes(getFileExtension(file))
  );

  console.log(
    `Changed Files (excluding binary files) : \n ${nonBinaryFiles.join("\n")}`
  );

  console.log(nonBinaryFiles);

  return nonBinaryFiles;
}

export function filterFilesByPattern(
  inputFiles: string[],
  inputPattern?: RegExp
) {
  let result = [];

  if (inputPattern) {
    result = inputFiles.filter((file) => inputPattern.test(file));
  } else {
    result = inputFiles;
  }

  return result;
}
