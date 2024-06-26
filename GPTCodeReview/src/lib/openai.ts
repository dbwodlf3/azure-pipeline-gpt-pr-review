import {
  OpenAIClient,
  AzureKeyCredential,
  ChatRequestMessageUnion,
  AzureChatExtensionConfigurationUnion,
  GetChatCompletionsOptions,
} from "@azure/openai";
import { ReviewManager } from "./manager";

interface GPTInput {
  resourceModelId: string;
  msg: ChatRequestMessageUnion[];
  apiKey: string;
  endpoint: string;

  options?: {
    filename?: string;
  };

  aiSearchExtension?: {
    endpoint: string;
    indexName: string;
    apiKey: string;
  };
}

export async function chatGPT(input: GPTInput) {
  let result;

  const openai = new OpenAIClient(
    input.endpoint,
    new AzureKeyCredential(input.apiKey)
  );

  const chatOptions: GetChatCompletionsOptions = {
    maxTokens: 1024,
  };

  if (input.aiSearchExtension) {
    chatOptions["azureExtensionOptions"] = {
      extensions: [
        {
          type: "azure_search",
          topNDocuments: 20,
          strictness: 3,
          endpoint: input.aiSearchExtension.endpoint,
          indexName: input.aiSearchExtension.indexName,
          authentication: {
            type: "api_key",
            key: input.aiSearchExtension.apiKey,
          },
        },
      ],
    };
  }

  result = await openai.getChatCompletions(
    input.resourceModelId,
    input.msg,
    chatOptions
  );

  if (input.options?.filename) {
    ReviewManager.info.usages.push({
      filename: input.options.filename,
      usages: result.usage,
    });
  } else {
    ReviewManager.info.usages.push({
      filename: "<<Undefined Filename>>",
      usages: result.usage,
    });
  }

  return result;
}
