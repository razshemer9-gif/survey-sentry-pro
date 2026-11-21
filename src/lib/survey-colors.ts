import { SurveyType, getSurveyType } from "./types";

/**
 * The colour that stands for a survey type on screen.
 *
 * `SURVEY_TYPES[].color` was chosen for white paper, and it is what the
 * printed reports use — it must not change, or every PDF changes with it.
 * On the dark interface those same colours fail: general safety (#1e3a8a)
 * measures 1.43:1 against the card, which is not a colour anybody can see.
 *
 * So the dark interface gets its own set. Same hue, same order of
 * recognition — the blue type stays blue — lifted until it reads. Measured
 * against the card (#182939), the weakest of the eight is 5.5:1, where 3.0
 * is the floor for a graphical mark.
 *
 * Nothing here is used by the PDF renderer.
 */
export const SURVEY_COLOR_ON_DARK: Record<SurveyType, string> = {
  accessibility:              "#4DA3FF", // 5.7
  education_safety:           "#3ED47A", // 7.7
  general_safety:             "#7BA7FF", // 6.2
  welfare_inspection:         "#2FD4F0", // 8.3
  element_stability:          "#2ED3BE", // 7.9
  risk_survey:                "#FF8A4C", // 6.4
  accessibility_form_8:       "#A98BFF", // 5.5
  accessibility_form_8_event: "#C58CFF", // 6.1
};

/**
 * The type's colour for the interface. Never a status colour: whether a
 * finding passed or failed is the report's business, and showing it in the
 * list would make two different things speak in the same voice.
 */
export function surveyColor(type: SurveyType | undefined, isDark: boolean): string {
  const config = getSurveyType(type ?? "accessibility");
  if (!isDark) return config.color;
  return SURVEY_COLOR_ON_DARK[config.id] ?? config.color;
}
