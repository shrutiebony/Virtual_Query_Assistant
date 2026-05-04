const SPLIT_PATTERNS = [
  /\?\s*(?:and also|and|also|additionally)\s+/i,
  /\s+and also\s+(?=show|get|find|list|display|give|what|which|how|count|top|total|average|sum)/i,
  /\s+also\s+(?=show|get|find|list|display|give|what|which|how|count|top|total|average|sum)/i,
  /\.\s+(?:also|and also)\s+/i,
  /;\s*/,
];

const GEMINI_PREFIX = 'Answer only this single question with one SQL query (do not use UNION): ';

/**
 * Returns array of { display, query } objects.
 * display → shown to user in the result label
 * query   → sent to the backend/Gemini
 */
export function splitQuestions(input) {
  const text = input.trim();

  for (const pattern of SPLIT_PATTERNS) {
    const parts = text
      .split(pattern)
      .map(p => p.replace(/\?+$/, '').trim())
      .filter(p => p.length > 4);

    if (parts.length >= 2) {
      return parts.map(p => ({
        display: p,
        query: GEMINI_PREFIX + p,
      }));
    }
  }

  // Single question — no prefix needed
  return [{ display: text.replace(/\?+$/, '').trim(), query: text.replace(/\?+$/, '').trim() }];
}