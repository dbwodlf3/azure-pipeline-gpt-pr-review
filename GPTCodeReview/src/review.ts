import fetch from "node-fetch";
import { git } from "./git";
import { addCommentToPR } from "./pr";
import { Agent } from "https";
import { SimpleGit } from "simple-git";
import { chatGPT } from "./lib/openai";
import { ChatRequestMessageUnion } from "@azure/openai";
import { ReviewManager } from "./lib/manager";

const prompts = {
  en: `
  Act as a code reviewer of a Pull Request, providing feedback on possible bugs and clean code issues.
  You are provided with the Pull Request changes in a patch format.
  Each patch entry has the commit message in the Subject line followed by the code changes (diffs) in a unidiff format.
  Don't need to describe enverything.

  As a code reviewer, your task is:
          - Review only added, edited or deleted lines.
          - If there's no bugs and the changes are correct, write only 'No feedback.'
          - If there's bug or uncorrect code changes, don't write 'No feedback.'
  `,
};

export async function reviewFile(input: {
  targetBranch: string;
  fileName: string;
  httpsAgent: Agent;
  aoi: {
    apiKey: string;
    aoiEndpoint: string;
    aoiModelResourceId: string;
    // Optional Params
    aiSearchExtension?: {
      endpoint: string;
      indexName: string;
      apiKey: string;
    };
    commentLanguage?: "en" | "ko";
    customInstruction?: string;
  };
  inputGit?: SimpleGit;
}) {
  console.log(`Start reviewing ${input.fileName} ...`);
  const __git = input.inputGit || git;
  const patch = await __git.diff([input.targetBranch, "--", input.fileName]);

  let instructions = prompts["en"];

  const patchLimit = ReviewManager.reviewOptions?.git?.patchLimit;
  const tokenLimit = ReviewManager.reviewOptions?.aoi?.tokenLimit;

  if (patchLimit && patchLimit < patch.length) {
    await addCommentToPR(
      input.fileName,
      `Skip AI Review, This file over patchLimit: ${patchLimit}`,
      input.httpsAgent
    );

    return;
  }

  if (tokenLimit && tokenLimit < ReviewManager.getTotalUsage()) {
    await addCommentToPR(
      input.fileName,
      `Skip AI Review, This over GPT Token Limit: ${tokenLimit}`,
      input.httpsAgent
    );

    return;
  }

  try {
    let choices: any;
    const resourceId: string = input.aoi.aoiModelResourceId!;
    const msg: ChatRequestMessageUnion[] = [
      {
        role: "system",
        content: instructions,
      },
      {
        role: "system",
        content: input.aoi.customInstruction,
      },
      {
        role: "user",
        content: patch,
      },
    ];

    if (input.aoi.commentLanguage == "ko") {
      msg.push({
        role: "system",
        content: `Translate your answer into korean. Asnwer in Korean.
          사용자에게 답변은 한국어로 번역해주세요. 사용자에게 답변은 한국어로 해 주세요.`,
      });
    }

    /** Start AI Review */
    const res = await chatGPT({
      endpoint: input.aoi.aoiEndpoint,
      resourceModelId: resourceId,
      apiKey: input.aoi.apiKey,
      msg: msg,
      options: {
        filename: `${input.fileName}`,
      },
    });

    choices = res.choices;

    if (choices && choices.length > 0) {
      const review = choices[0].message?.content as string;

      console.log("Review File:", input.fileName);
      console.log("====================================");
      console.log("Review Start");
      console.log("====================================");
      console.log(review);
      console.log("====================================");
      console.log("Review End");
      console.log("====================================");

      if (review.trim() !== "No feedback.") {
        if (process.env.NODE_ENV == "test") {
          return {
            fileName: input.fileName,
            review,
            httpsAgent: input.httpsAgent,
          };
        } else {
          await addCommentToPR(input.fileName, review, input.httpsAgent);
          return;
        }
      }
    }
    /** END AI Review */

    console.log(`Review of ${input.fileName} completed.`);
  } catch (error: any) {
    if (error.response) {
      console.log(error.response.status);
      console.log(error.response.data);
    } else {
      console.log(error.message);
    }
  }
}
