import Link from "next/link";
import experiments from "data/lab.json";
import Flow from "./Flow";

const experiment = experiments.find((e) => e.slug === "flow");
const pageTitle = `${experiment.title} — Yunus Eş`;

export const metadata = {
  title: pageTitle,
  description: experiment.description,
  openGraph: {
    title: pageTitle,
    description: experiment.description,
  },
};

export default function FlowPage() {
  return (
    <main id="main" className="fixed inset-0 bg-black">
      <Link
        href="/lab"
        aria-label="Lab'a dön"
        className="fixed top-4 left-4 z-40 inline-flex items-center gap-2 px-3 py-2 rounded text-white/75 hover:text-white bg-white/5 hover:bg-white/15 border border-white/10 hover:border-white/25 backdrop-blur-sm transition text-[13px]"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        <span>Lab</span>
      </Link>

      <Flow />
    </main>
  );
}
