import { ReportListScreen } from "@/components/ReportListScreen";

/**
 * Everything the account is allowed to see, whoever wrote it, with the name
 * of the employee on each row.
 *
 * The route is behind AdminRoute and the rows themselves come from the
 * database under the same policies as everywhere else: an employee reaching
 * this address directly is sent home, and would in any case receive only
 * their own reports.
 */
const CompanyReports = () => (
  <ReportListScreen
    title="דוחות החברה"
    scope="all"
    searchPlaceholder="חיפוש לפי שם, כתובת, סוג או עובד"
    showAuthor
    emptyText="אין עדיין דוחות בחברה."
  />
);

export default CompanyReports;
