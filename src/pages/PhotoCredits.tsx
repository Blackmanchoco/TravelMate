import { usePhotoCredits } from "../hooks/usePhotoCredits";

export default function PhotoCredits() {
  const { credits, error } = usePhotoCredits();
  return <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
    <h1 className="text-3xl font-semibold text-fg">Photo credits</h1>
    <p className="mt-4 text-muted">Approved local destination and place photographs. Files have been resized and JPEG compressed; display crops use a subject focal point. Share-alike images retain their listed license.</p>
    {error && <p role="alert" className="mt-6 text-fg">Photo credits could not be loaded. Please reload this page.</p>}
    {!error && credits.length === 0 && <p className="mt-6 text-muted">Loading photo credits...</p>}
    <ul className="mt-8 space-y-6">{credits.map((credit) => <li key={credit.file} className="rounded-panel border border-line bg-surface p-6">
      <h2 className="text-xl font-semibold text-fg">{credit.title}</h2>
      <p className="mt-2 text-fg">Photo by <bdi dir="auto">{credit.author}</bdi></p>
      <div className="mt-3 flex flex-wrap gap-5 text-accent">
        <a href={credit.licenseUrl} target="_blank" rel="noopener noreferrer" className="underline">{credit.license}</a>
        {credit.note ? ` ${credit.note}` : null}
        <a href={credit.sourcePageUrl} target="_blank" rel="noopener noreferrer" className="underline">Source image page</a>
      </div>
    </li>)}</ul>
    <section className="mt-10 rounded-panel border border-line bg-surface p-6">
      <h2 className="text-xl font-semibold text-fg">Place data</h2>
      <p className="mt-2 text-fg">Place names and coordinates in the expanded catalogue include data from OpenStreetMap contributors, available under the Open Database License (ODbL).</p>
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-accent underline">OpenStreetMap copyright and license</a>
    </section>
  </main>;
}
