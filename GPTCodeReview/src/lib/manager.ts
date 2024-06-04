/** This file is for global */

interface ReviewUsage {
  filename: string;
  usages:
    | {
        completionTokens: number;
        promptTokens: number;
        totalTokens: number;
      }
    | undefined;
}

interface IReviewManager {
  getTotalUsage: () => number;
  info: {
    usages: ReviewUsage[];
  };
  reviewOptions: {
    git: {
      patchLimit: number;
    };
    aoi: {
      tokenLimit: number;
    };
  };
}

export const ReviewManager: IReviewManager = {
  getTotalUsage: function () {
    return ReviewManager.info.usages.reduce((acc, cur) => {
      if (cur.usages) {
        return acc + cur.usages.totalTokens;
      }
      return acc;
    }, 0);
  },
  info: {
    usages: [] as ReviewUsage[],
  },
  reviewOptions: {
    git: {
      patchLimit: 2048,
    },
    aoi: {
      tokenLimit: 20000,
    },
  },
};
