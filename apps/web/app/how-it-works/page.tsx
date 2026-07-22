import { PublicFrame } from "../../components/shell";

export default function HowItWorksPage() {
  return <PublicFrame className="min-h-screen px-5 py-24"><div className="mx-auto max-w-3xl"><h1 className="text-4xl font-semibold">How it works</h1><ol className="mt-8 grid gap-5 text-slate-600"><li>1. Clients post URL tasks.</li><li>2. Active online scanners receive automatic notifications.</li><li>3. PostgreSQL accepts exactly one claim for each task.</li><li>4. Scanner submits proof, Client confirms, ledgers settle atomically.</li></ol></div></PublicFrame>;
}
