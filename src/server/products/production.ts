const KG_SCALE = 2;
const TON_SCALE = 3;
const PERCENT_SCALE = 2;
const CM_PER_M = 100;
const G_PER_KG = 1000;
const KG_PER_TON = 1000;

/**
 * Weight of a single roll, from its geometry and the paper's grammage.
 *
 *   area m²  = length_m × (width_cm / 100)
 *   weight g = area × gsm
 *   weight kg = weight g / 1000
 *
 * This is a suggestion for the operator, not a replacement for the scale —
 * the stored weight should be what was actually measured.
 */
export function computeWeightKg(lengthM: string, widthCm: string, gsm: string): string {
  const length = Number(lengthM);
  const width = Number(widthCm);
  const grammage = Number(gsm);

  if (!(length > 0) || !(width > 0)) {
    throw new RangeError("Length and width must be greater than zero");
  }
  if (!(grammage > 0)) {
    throw new RangeError("GSM must be greater than zero");
  }

  return ((length * (width / CM_PER_M) * grammage) / G_PER_KG).toFixed(KG_SCALE);
}

/**
 * Tons of raw material a production run consumes.
 *
 * weightKg is PER ROLL, so quantity multiplies it. Waste covers trim loss:
 * a run that yields 1 ton of product eats more than 1 ton of material.
 */
export function computeConsumedTons(
  weightKg: string,
  quantity: number,
  wastePercent: string,
): string {
  const weight = Number(weightKg);
  const waste = Number(wastePercent);

  if (!(weight > 0)) {
    throw new RangeError("Weight must be greater than zero");
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new RangeError("Quantity must be a positive integer");
  }
  if (!(waste >= 0)) {
    throw new RangeError("Waste percent must be zero or greater");
  }

  const totalKg = weight * quantity * (1 + waste / 100);
  return (totalKg / KG_PER_TON).toFixed(TON_SCALE);
}

/**
 * A material's own waste percentage, or the global default when it has none.
 * NULL means "not set"; "0" is a deliberate zero and must survive.
 */
export function resolveWastePercent(
  typeWastePercent: string | null,
  defaultWastePercent: number,
): string {
  const source = typeWastePercent ?? String(defaultWastePercent);
  return Number(source).toFixed(PERCENT_SCALE);
}

/**
 * Rows the application writes and owns. A user editing one by hand would
 * desynchronise it from its product, so those paths refuse.
 */
export function isSystemManaged(source: string): boolean {
  return source === "production";
}
