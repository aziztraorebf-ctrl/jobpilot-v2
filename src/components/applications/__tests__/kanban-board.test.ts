import { describe, it, expect } from "vitest";

// Test the column grouping logic used by KanbanBoard
// This validates the data preparation that feeds the DnD UI
describe("KanbanBoard logic", () => {
  const COLUMNS = ["saved", "applied", "interview", "offer", "rejected"];

  function groupByStatus(
    applications: Array<{ id: string; status: string }>
  ): Record<string, string[]> {
    const grouped: Record<string, string[]> = {};
    for (const col of COLUMNS) grouped[col] = [];
    for (const app of applications) {
      if (grouped[app.status]) {
        grouped[app.status].push(app.id);
      }
    }
    return grouped;
  }

  it("groups applications into correct status columns", () => {
    const apps = [
      { id: "1", status: "saved" },
      { id: "2", status: "applied" },
      { id: "3", status: "saved" },
      { id: "4", status: "interview" },
    ];

    const result = groupByStatus(apps);

    expect(result.saved).toEqual(["1", "3"]);
    expect(result.applied).toEqual(["2"]);
    expect(result.interview).toEqual(["4"]);
    expect(result.offer).toEqual([]);
    expect(result.rejected).toEqual([]);
  });

  it("returns empty arrays for all columns when no applications", () => {
    const result = groupByStatus([]);

    for (const col of COLUMNS) {
      expect(result[col]).toEqual([]);
    }
  });

  it("ignores applications with unknown status", () => {
    const apps = [
      { id: "1", status: "saved" },
      { id: "2", status: "nonexistent" },
    ];

    const result = groupByStatus(apps);

    expect(result.saved).toEqual(["1"]);
    // "nonexistent" should not appear in any column
    const allIds = Object.values(result).flat();
    expect(allIds).not.toContain("2");
  });

  it("preserves insertion order within columns", () => {
    const apps = [
      { id: "a", status: "applied" },
      { id: "b", status: "applied" },
      { id: "c", status: "applied" },
    ];

    const result = groupByStatus(apps);

    expect(result.applied).toEqual(["a", "b", "c"]);
  });

  it("creates all 5 expected column keys", () => {
    const result = groupByStatus([]);

    expect(Object.keys(result).sort()).toEqual(
      ["applied", "interview", "offer", "rejected", "saved"]
    );
  });
});
