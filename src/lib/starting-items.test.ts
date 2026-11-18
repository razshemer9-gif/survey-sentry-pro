import { describe, expect, it } from "vitest";
import { pickSavedList, savedListToItems, TYPES_WITH_SAVED_START } from "./starting-items";

const rows = [
  { id: "edu", name: "סקר בטיחות מוסדות חינוך", survey_type: "education_safety" },
  { id: "acc", name: 'סקר נגישות מתו"ס ושירות', survey_type: null },
  { id: "gen", name: "סקר בטיחות כללי", survey_type: null },
];

describe("pickSavedList", () => {
  it("matches the list saved against this report type", () => {
    expect(pickSavedList(rows, "education_safety", "סקר בטיחות מוסדות חינוך")?.id).toBe("edu");
  });

  it("falls back to a list named after the type, for rows saved before the type was recorded", () => {
    expect(pickSavedList(rows, "accessibility", 'סקר נגישות מתו"ס ושירות')?.id).toBe("acc");
  });

  it("matches across the two ways Hebrew quotation marks are typed", () => {
    expect(pickSavedList(rows, "accessibility", "סקר נגישות מתו״ס ושירות")?.id).toBe("acc");
    expect(pickSavedList(
      [{ id: "a", name: "סקר נגישות מתו״ס ושירות", survey_type: null }],
      "accessibility",
      'סקר נגישות מתו"ס ושירות',
    )?.id).toBe("a");
  });

  it("prefers the tagged row over one that merely shares the label", () => {
    const both = [
      { id: "by-name", name: "סקר נגישות", survey_type: null },
      { id: "by-type", name: "משהו אחר", survey_type: "accessibility" },
    ];
    expect(pickSavedList(both, "accessibility", "סקר נגישות")?.id).toBe("by-type");
  });

  it("returns null when the account has no list, so the report still opens", () => {
    expect(pickSavedList([], "accessibility", "סקר נגישות")).toBeNull();
    expect(pickSavedList(rows, "risk_survey", "סקר סיכונים")).toBeNull();
  });
});

describe("savedListToItems", () => {
  it("carries over the professional work on every finding", () => {
    const [item] = savedListToItems([{
      title: "שילוט- כניסה נגישה",
      suggestedCorrection: 'בכניסה הנגישה למתחם יוצב שילוט "כניסה נגישה".',
      standardPart: "1",
      clause: "7.1",
      matchedRequirementId: "req-12",
      referencePhoto: "data:image/png;base64,AAA",
      referencePhotos: ["data:image/png;base64,BBB"],
      referenceLabel: "פרט 12",
    }]);
    expect(item).toMatchObject({
      title: "שילוט- כניסה נגישה",
      status: "non_compliant",
      suggestedCorrection: 'בכניסה הנגישה למתחם יוצב שילוט "כניסה נגישה".',
      standardPart: "1",
      clause: "7.1",
      matchedRequirementId: "req-12",
      referencePhoto: "data:image/png;base64,AAA",
      referencePhotos: ["data:image/png;base64,BBB"],
      referenceLabel: "פרט 12",
    });
    expect(item.id).toBeTruthy();
  });

  it("gives every finding its own id", () => {
    const items = savedListToItems([{ title: "א" }, { title: "ב" }, { title: "ג" }]);
    expect(new Set(items.map((i) => i.id)).size).toBe(3);
  });

  it("leaves out what the list does not carry, rather than writing empties", () => {
    const [item] = savedListToItems([{ title: "בלי כלום" }]);
    expect(item).toEqual({ id: item.id, title: "בלי כלום", status: "non_compliant", notes: "", estimatedCost: 0 });
  });

  it("takes the default cost and priority the list set", () => {
    const [item] = savedListToItems([{ title: "עם עלות", defaultCost: 2500, defaultPriority: 1 }]);
    expect(item.estimatedCost).toBe(2500);
    expect(item.priority).toBe(1);
  });
});

describe("TYPES_WITH_SAVED_START", () => {
  it("covers the accessibility survey and nothing else", () => {
    expect(TYPES_WITH_SAVED_START).toEqual(["accessibility"]);
  });
});
