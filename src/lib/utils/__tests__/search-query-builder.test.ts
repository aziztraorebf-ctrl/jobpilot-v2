import { describe, it, expect } from "vitest";
import { buildSearchQueries, nextRotationIndex } from "../search-query-builder";

describe("buildSearchQueries", () => {
  it("retourne tableau vide si keywords vide", () => {
    expect(buildSearchQueries([], 0)).toEqual([]);
  });

  it("retourne tableau vide si keywords undefined", () => {
    expect(buildSearchQueries(undefined, 0)).toEqual([]);
  });

  it("retourne les 4 premiers keywords à index 0", () => {
    const kw = ["A", "B", "C", "D", "E", "F", "G"];
    expect(buildSearchQueries(kw, 0)).toEqual(["A", "B", "C", "D"]);
  });

  it("retourne le groupe suivant à index 1", () => {
    const kw = ["A", "B", "C", "D", "E", "F", "G"];
    expect(buildSearchQueries(kw, 1)).toEqual(["E", "F", "G"]);
  });

  it("boucle au début quand index dépasse le nombre de groupes", () => {
    const kw = ["A", "B", "C", "D", "E", "F", "G"];
    expect(buildSearchQueries(kw, 2)).toEqual(["A", "B", "C", "D"]);
  });

  it("groupe partiel en fin de liste", () => {
    const kw = ["A", "B", "C", "D", "E"];
    expect(buildSearchQueries(kw, 1)).toEqual(["E"]);
  });

  it("respecte le paramètre groupSize", () => {
    const kw = ["A", "B", "C", "D", "E", "F"];
    expect(buildSearchQueries(kw, 0, 3)).toEqual(["A", "B", "C"]);
  });
});

describe("nextRotationIndex", () => {
  it("incrémente l'index normalement", () => {
    const kw = ["A", "B", "C", "D", "E", "F", "G"];
    expect(nextRotationIndex(kw, 0)).toBe(1);
  });

  it("remet à 0 quand on a épuisé tous les groupes", () => {
    const kw = ["A", "B", "C", "D", "E", "F", "G"]; // 2 groupes de 4 (0 et 1)
    expect(nextRotationIndex(kw, 1)).toBe(0);
  });

  it("retourne 0 si keywords vide", () => {
    expect(nextRotationIndex([], 0)).toBe(0);
  });
});
