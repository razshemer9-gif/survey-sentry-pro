import { ReportListScreen } from "@/components/ReportListScreen";

/** Every report this account wrote. Reached from "הצג הכל" and from the bar. */
const MyReports = () => (
  <ReportListScreen
    title="הדוחות שלי"
    scope="mine"
    searchPlaceholder="חיפוש לפי שם, כתובת או סוג"
    emptyText="עוד לא יצרת דוחות."
  />
);

export default MyReports;
