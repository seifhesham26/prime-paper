/**
 * Pure equation parsing for dashboard cards.
 *
 * The resolver is injected so this module never touches the database and can
 * be unit-tested. DB-backed resolution lives in equation-variables.ts.
 */

export type Resolver = (token: string) => Promise<number>;

/** Split on the given operators, but only at parenthesis depth zero. */
function splitAtDepth(expr: string, operators: string[]) {
  const parts: string[] = [];
  const ops: string[] = [];
  let current = "";
  let depth = 0;

  for (const char of expr) {
    if (char === "(") depth++;
    if (char === ")") depth--;

    if (depth === 0 && operators.includes(char)) {
      parts.push(current.trim());
      ops.push(char);
      current = "";
    } else {
      current += char;
    }
  }
  parts.push(current.trim());
  return { parts, ops };
}

function assertWellFormed(parts: string[], equation: string) {
  if (parts.some((p) => p.length === 0)) {
    throw new Error(`Malformed equation: "${equation}"`);
  }
}

export async function evaluateEquation(
  equation: string,
  resolve: Resolver,
): Promise<number> {
  if (!equation.trim()) {
    throw new Error("Equation is empty");
  }

  const { parts: terms, ops: addOps } = splitAtDepth(equation, ["+", "-"]);
  assertWellFormed(terms, equation);

  let result = 0;

  for (let i = 0; i < terms.length; i++) {
    const { parts: factors, ops: mulOps } = splitAtDepth(terms[i], ["*", "/"]);
    assertWellFormed(factors, equation);

    let termValue = await resolve(factors[0]);
    for (let j = 0; j < mulOps.length; j++) {
      const next = await resolve(factors[j + 1]);
      if (mulOps[j] === "*") termValue *= next;
      else termValue = next === 0 ? 0 : termValue / next;
    }

    // addOps[i - 1] precedes this term; the first term is implicitly "+".
    if (i === 0 || addOps[i - 1] === "+") result += termValue;
    else result -= termValue;
  }

  return Math.round(result * 100) / 100;
}

/** Variable tokens in an equation, excluding operators and numeric constants. */
export function extractTokens(equation: string): string[] {
  const { parts: terms } = splitAtDepth(equation, ["+", "-"]);
  return terms
    .flatMap((term) => splitAtDepth(term, ["*", "/"]).parts)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !Number.isFinite(Number(t)));
}

export function validateEquation(
  equation: string,
  known: Set<string>,
): { ok: true } | { ok: false; unknown: string[] } {
  if (!equation.trim()) return { ok: false, unknown: [] };

  let tokens: string[];
  try {
    const { parts: terms } = splitAtDepth(equation, ["+", "-"]);
    assertWellFormed(terms, equation);
    for (const term of terms) {
      const { parts: factors } = splitAtDepth(term, ["*", "/"]);
      assertWellFormed(factors, equation);
    }
    tokens = extractTokens(equation);
  } catch {
    return { ok: false, unknown: [] };
  }

  const unknown = tokens.filter((t) => !known.has(t));
  return unknown.length === 0 ? { ok: true } : { ok: false, unknown };
}
