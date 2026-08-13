import EntryForm from "./components/EntryForm";

export default function Home() {
  return (
    <main className="page">
      <div className="brand">
        <h1>MSMAS</h1>
        <span>New entry</span>
      </div>
      <div className="card">
        <EntryForm />
      </div>
    </main>
  );
}
