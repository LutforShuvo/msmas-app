import EntryForm from "./components/EntryForm";

export default function Home() {
  return (
    <main className="page">
      <h2 className="page-title">New Entry</h2>
      <div className="card">
        <EntryForm />
      </div>
    </main>
  );
}
