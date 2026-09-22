import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Devuelve true si la sede está en la lista de sedes adjudicadas del profesional.
 * Si el profesional tiene `assignedSedes` vacío (no se ha rellenado), se considera
 * "sin restricción" → devuelve true (no bloqueamos la asignación).
 *
 * El CSV del profesional usa ", " como separador (ver ProfesionalTab). Aquí
 * toleramos tanto "," como ", " y se trimea cada item.
 *
 * La comparación es case-insensitive y sin espacios, igual que en UserView.
 */
export function isProAssignedToSede(
  proAssignedSedes: string | undefined | null,
  sedeName: string,
): boolean {
  if (!proAssignedSedes) return true; // sin restricción explícita → permitido
  const list = proAssignedSedes
    .split(",")
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);
  if (list.length === 0) return true; // CSV vacío → permitido
  return list.includes((sedeName || "").trim().toUpperCase());
}
