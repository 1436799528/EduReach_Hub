import type { ExtractedItem } from './extract';

export type ItemInput = {
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE?: string | null;
  correctOption?: string | null;
};

export type Validation = {
  /** Issues that prevent approval and saving. */
  blocking: string[];
  /** Facts worth showing the reviewer that do not block approval. */
  notes: string[];
};

const MIN_QUESTION_LENGTH = 8;

function clean(value: string | null | undefined): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

/**
 * One authority for what a savable question looks like. The review screen, the
 * approve action and the save action all call this: approving an item cannot
 * bypass a rule that the UI merely hid.
 *
 * The live CBT engine stores four options (A-D). A fifth option is reported
 * rather than truncated, because dropping a distractor changes the question.
 */
export function validateItem(item: ItemInput, options: { duplicateOf?: string | null } = {}): Validation {
  const blocking: string[] = [];
  const notes: string[] = [];
  const questionText = clean(item.questionText);
  const choices = [item.optionA, item.optionB, item.optionC, item.optionD]
    .map((option) => clean(option));
  const extra = clean(item.optionE);

  if (!questionText) blocking.push('Question text is missing.');
  else if (questionText.length < MIN_QUESTION_LENGTH) blocking.push('Question text is too short to be usable.');

  if (choices.some((option) => !option)) {
    blocking.push('All four answer options (A-D) are required.');
  }
  if (extra) {
    blocking.push('Five options were found. The CBT bank stores four: remove one option and re-check the key.');
  }
  const filled = choices.filter(Boolean).map((option) => option.toLowerCase());
  if (filled.length !== new Set(filled).size) {
    blocking.push('Two or more options have the same text.');
  }

  const answer = clean(item.correctOption).toUpperCase();
  if (!answer) {
    blocking.push('The answer key was not found. Choose the correct option after checking the paper.');
  } else if (!/^[A-D]$/.test(answer)) {
    blocking.push('The correct option must be A, B, C or D.');
  }

  if (options.duplicateOf) {
    notes.push('A question with this text already exists in the bank. Saving will skip it.');
  }
  return { blocking, notes };
}

/** Applies the four-option/shape rules to a fresh extraction result. */
export function validateExtracted(item: ExtractedItem): Validation {
  return validateItem(item);
}

export function normaliseItem(item: ItemInput) {
  return {
    questionText: clean(item.questionText),
    optionA: clean(item.optionA),
    optionB: clean(item.optionB),
    optionC: clean(item.optionC),
    optionD: clean(item.optionD),
    optionE: clean(item.optionE) || null,
    correctOption: clean(item.correctOption).toUpperCase().slice(0, 1) || null,
  };
}

/** Normalised text used for duplicate detection inside one import and against a bank. */
export function questionFingerprint(value: string): string {
  return clean(value)
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
