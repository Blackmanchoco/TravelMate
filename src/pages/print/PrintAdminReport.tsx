import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCatalogReport, type CatalogReport } from "../../api/admin.api";
import "./print-itinerary.css";
import "./print-admin-report.css";

export default function PrintAdminReport() {
  const [report, setReport] = useState<CatalogReport | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError(false); setReport(null);
    void getCatalogReport(controller.signal).then((data) => {
      if (!controller.signal.aborted) setReport(data);
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [attempt]);
  return <main className="print-shell">
    <div className="print-toolbar"><Link to="/admin">Back to administration</Link><button disabled={!report} onClick={() => window.print()}>Print / Save as PDF</button></div>
    {error ? <div role="alert" className="print-message"><p>Unable to load the administrator report.</p><button onClick={() => setAttempt(attempt + 1)}>Retry</button></div>
      : !report ? <p role="status" className="print-message">Loading administrator report...</p>
      : <article className="print-document admin-print">
        <header className="print-cover"><p className="print-brand">TravelMate · Administrator report</p><h1>Catalogue coverage</h1><p>Generated {new Date(report.generatedAt).toLocaleString("en-MY", {timeZone:"Asia/Kuala_Lumpur"})} (Asia/Kuala_Lumpur)</p></header>
        <h2>Totals</h2><dl className="print-summary-grid">
          <div><dt>Discoverable places</dt><dd>{report.totals.discoverable}</dd></div>
          <div><dt>Archived places</dt><dd>{report.totals.archived}</dd></div>
          <div><dt>Test fixtures</dt><dd>{report.totals.test}</dd></div>
        </dl>
        <h2>By destination</h2><table><thead><tr><th>Destination</th><th>Discoverable</th><th>Archived</th></tr></thead><tbody>{report.byDestination.map(row => <tr key={row.destinationId}><td>{row.name}</td><td>{row.discoverable}</td><td>{row.archived}</td></tr>)}</tbody></table>
        <h2>By category</h2><p>Discoverable places only.</p><table><thead><tr><th>Category</th><th>Count</th></tr></thead><tbody>{report.byCategory.map(row => <tr key={row.category}><td>{row.category}</td><td>{row.count}</td></tr>)}</tbody></table>
        <h2>Audit log summary</h2><p>{report.auditSummary.total} recorded actions across the retained audit log.</p><table><thead><tr><th>Action</th><th>Count</th></tr></thead><tbody>{report.auditSummary.byAction.map(row => <tr key={row.action}><td>{row.action}</td><td>{row.count}</td></tr>)}</tbody></table>
        {report.auditSummary.total === 0 && <p>No audit actions recorded.</p>}
        <footer className="print-footer">Live aggregate counts. No account identifiers are included.</footer>
      </article>}
  </main>;
}
