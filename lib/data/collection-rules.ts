import type {
  Collection,
  CollectionRule,
  CollectionRuleSet,
  Product,
} from "@/types";
import { minVariantPrice } from "./products";

/**
 * Smart-collection rule engine (Phase 4) — pure, dependency-free so it's unit-tested
 * in isolation and reused both for storefront resolution and admin preview. A smart
 * collection's membership is whichever ACTIVE products satisfy its rule set; manual
 * collections ignore rules entirely (see `getCollectionProducts`).
 */

/** The string field a rule reads off a product (price handled separately). */
function stringValues(product: Product, field: CollectionRule["field"]): string[] {
  switch (field) {
    case "tag":
      return product.tags ?? [];
    case "productType":
      return product.productType ? [product.productType] : [];
    case "vendor":
      return product.vendor ? [product.vendor] : [];
    case "title":
      return [product.title];
    default:
      return [];
  }
}

/** Evaluate a single rule against a product. */
export function productMatchesRule(product: Product, rule: CollectionRule): boolean {
  const value = rule.value.trim();
  if (!value) return false; // an empty rule never matches (avoids "matches everything")

  if (rule.field === "price") {
    const price = minVariantPrice(product);
    const target = Number(value);
    if (!Number.isFinite(target)) return false;
    switch (rule.op) {
      case "equals":
        return price === target;
      case "not_equals":
        return price !== target;
      case "gt":
        return price > target;
      case "lt":
        return price < target;
      default:
        return false; // contains/starts_with are nonsensical for price
    }
  }

  const needle = value.toLowerCase();
  const haystack = stringValues(product, rule.field).map((s) => s.toLowerCase());
  switch (rule.op) {
    case "equals":
      return haystack.some((s) => s === needle);
    case "not_equals":
      return haystack.length > 0 && !haystack.some((s) => s === needle);
    case "contains":
      return haystack.some((s) => s.includes(needle));
    case "starts_with":
      return haystack.some((s) => s.startsWith(needle));
    default:
      return false; // gt/lt are nonsensical for text
  }
}

/** Does a product satisfy the whole rule set (AND for `all`, OR for `any`)? */
export function productMatchesRules(product: Product, rules: CollectionRuleSet): boolean {
  const conditions = rules.conditions.filter((c) => c.value.trim());
  if (conditions.length === 0) return false; // no usable conditions → empty collection
  return rules.match === "any"
    ? conditions.some((c) => productMatchesRule(product, c))
    : conditions.every((c) => productMatchesRule(product, c));
}

/** Filter a product list to a smart collection's members, preserving input order. */
export function filterProductsByRules(
  products: Product[],
  rules: CollectionRuleSet | null | undefined,
): Product[] {
  if (!rules) return [];
  return products.filter((p) => productMatchesRules(p, rules));
}

/** True when a collection resolves membership by rules rather than a curated list. */
export function isSmartCollection(collection: Pick<Collection, "kind">): boolean {
  return collection.kind === "smart";
}
