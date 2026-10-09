import LabExitLink from "components/atoms/LabExitLink";
import { experimentMetadata } from "../experimentMetadata";
import ExperimentSchemas from "../ExperimentSchemas";
import Flow from "./Flow";

export const metadata = experimentMetadata("flow");

export default function FlowPage() {
  return (
    <main id="main" data-lab-stage className="fixed inset-0 bg-black">
      <ExperimentSchemas slug="flow" />
      <LabExitLink />

      <Flow />
    </main>
  );
}
