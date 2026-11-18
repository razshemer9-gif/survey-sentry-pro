import { describe, expect, it } from "vitest";
import { pickSavedList, savedListToItems, TYPES_WITH_SAVED_START } from "./starting-items";

const rows = [
  { id: "edu", name: "סקר בטיחות מוסדות חינוך", survey_type: "education_safety" },
  { id: "acc", name: 'סקר נגישות מתו"ס ושירות', survey_type: null },
  { id: "gen", name: "סקר בטיחות כללי", survey_type: null },
];

const OWNER = "owner-uuid";
const EMPLOYEE = "employee-uuid";

describe("pickSavedList", () => {
  it("matches the list saved against this report type", () => {
    expect(pickSavedList(rows, "education_safety", "סקר בטיחות מוסדות חינוך", OWNER)?.id).toBe("edu");
  });

  it("falls back to a list named after the type, for rows saved before the type was recorded", () => {
    expect(pickSavedList(rows, "accessibility", 'סקר נגישות מתו"ס ושירות', OWNER)?.id).toBe("acc");
  });

  it("matches across the two ways Hebrew quotation marks are typed", () => {
    expect(pickSavedList(rows, "accessibility", "סקר נגישות מתו״ס ושירות", OWNER)?.id).toBe("acc");
    expect(pickSavedList(
      [{ id: "a", name: "סקר נגישות מתו״ס ושירות", survey_type: null }],
      "accessibility",
      'סקר נגישות מתו"ס ושירות',
      OWNER,
    )?.id).toBe("a");
  });

  it("prefers the tagged row over one that merely shares the label", () => {
    const both = [
      { id: "by-name", name: "סקר נגישות", survey_type: null },
      { id: "by-type", name: "משהו אחר", survey_type: "accessibility" },
    ];
    expect(pickSavedList(both, "accessibility", "סקר נגישות", OWNER)?.id).toBe("by-type");
  });

  it("returns null when the account has no list, so the report still opens", () => {
    expect(pickSavedList([], "accessibility", "סקר נגישות", OWNER)).toBeNull();
    expect(pickSavedList(rows, "risk_survey", "סקר סיכונים", OWNER)).toBeNull();
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

describe("pickSavedList — the company list", () => {
  const company = {
    id: "company", name: "סקר נגישות מתו״ס ושירות",
    survey_type: "accessibility", user_id: OWNER, shared: true,
  };

  it("gives an employee with no list of their own the owner's", () => {
    expect(pickSavedList([company], "accessibility", "סקר נגישות מתו״ס ושירות", EMPLOYEE)?.id)
      .toBe("company");
  });

  it("lets an account's own list win over the company one", () => {
    const own = {
      id: "own", name: "משלי", survey_type: "accessibility",
      user_id: EMPLOYEE, shared: false,
    };
    expect(pickSavedList([company, own], "accessibility", "סקר נגישות מתו״ס ושירות", EMPLOYEE)?.id)
      .toBe("own");
  });

  it("is the owner's own list when the owner starts a survey", () => {
    expect(pickSavedList([company], "accessibility", "סקר נגישות מתו״ס ושירות", OWNER)?.id)
      .toBe("company");
  });

  it("ignores another account's list that was never published", () => {
    const private_ = { ...company, id: "private", shared: false };
    expect(pickSavedList([private_], "accessibility", "סקר נגישות מתו״ס ושירות", EMPLOYEE))
      .toBeNull();
  });

  it("treats rows with no user_id as the account's own, as the narrow read returns them", () => {
    expect(pickSavedList(rows, "accessibility", 'סקר נגישות מתו"ס ושירות', OWNER)?.id).toBe("acc");
  });

  it("claims nothing as its own when there is no identity to compare against", () => {
    const own = { id: "own", name: "משלי", survey_type: "accessibility", user_id: OWNER, shared: false };
    expect(pickSavedList([own], "accessibility", "משלי", null)).toBeNull();
    expect(pickSavedList([company], "accessibility", "סקר נגישות מתו״ס ושירות", null)?.id).toBe("company");
  });
});
