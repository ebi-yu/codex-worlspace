// 1. browser／provider境界はruntimeで検証する。詳細はADR 0002を参照。
// @ts-nocheck
const SCORE = Object.freeze({
  usefulness: {
    instructions:
      "How useful is `result` for answering `query`, based only on the supplied search-result metadata?",
    criteria: [
      "Unlikely to help",
      "May contain a small amount of relevant information",
      "Relevant but incomplete",
      "Likely useful",
      "Highly likely to directly answer the query",
    ],
  },
  specificity: {
    instructions: "How specific and actionable is `result` likely to be?",
    criteria: ["Abstract", "Some detail", "Concrete", "Highly actionable"],
  },
  freshness: {
    instructions:
      "How likely is `result` to be current enough for `query`? Use the lowest level when metadata is insufficient.",
    criteria: ["Unknown", "Possibly outdated", "Probably current", "Clearly current"],
  },
  transparency: {
    instructions: "How transparent does `result` appear about authorship and sources?",
    criteria: ["Unknown", "Limited", "Adequate", "Highly transparent"],
  },
  commercial_intent: {
    instructions: "How strongly is `result` focused on purchase or registration?",
    criteria: ["Informational", "Some commercial intent", "Mostly commercial", "Strongly commercial"],
  },
});

const CHOICE = Object.freeze({
  prerequisite_level: {
    instructions:
      "What level of prior knowledge would a reader likely need to use `result`?",
    criteria: {
      introductory: "No prior knowledge is expected",
      basic: "Basic vocabulary or concepts are expected",
      practical: "Some hands-on experience is expected",
      advanced: "Strong domain knowledge is expected",
      expert: "Specialist or research-level knowledge is expected",
      unknown: "The required prior knowledge cannot be inferred",
    },
  },
  source_type: {
    instructions: "What kind of source does `result` appear to be?",
    criteria: {
      official: "Official documentation or a primary source",
      editorial: "An article or explanatory secondary source",
      community: "A forum, Q&A, or community discussion",
      academic: "A research paper or scholarly publication",
      commercial: "A commercial or transactional page",
      unknown: "There is not enough evidence in the metadata",
    },
  },
  audience: {
    instructions: "Who is the likely audience for `result`?",
    criteria: {
      children: "Content explicitly intended for children",
      general: "A general audience",
      student: "Learners or students",
      practitioner: "Working practitioners",
      expert: "Specialists or researchers",
      unknown: "The audience cannot be inferred",
    },
  },
  reading_effort: {
    instructions: "How much reading effort is `result` likely to require?",
    criteria: {
      quick: "A short answer or overview",
      standard: "A standard article",
      in_depth: "A detailed guide",
      reference: "Reference material for repeated use",
      unknown: "The effort cannot be inferred",
    },
  },
});

// 2. toggleで有効な軸だけをTypeSafeのquestionへ変換する。
export function buildQuestions(axes) {
  return Object.fromEntries(
    axes.ids.map((id) => {
      if (SCORE[id]) return [id, { type: "score", ...structuredClone(SCORE[id]) }];
      if (CHOICE[id]) return [id, { type: "choice", ...structuredClone(CHOICE[id]) }];
      if (id === "primary_source") {
        return [
          id,
          {
            type: "noul",
            instructions: "Is `result` likely to be an official or primary source?",
            criteria: {
              true: "Official, original, or first-party information",
              false: "Secondary, derivative, or unknown information",
            },
          },
        ];
      }
      throw new TypeError(`question is not defined for axis: ${id}`);
    }),
  );
}
