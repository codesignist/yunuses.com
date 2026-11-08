import LabExitLink from "components/atoms/LabExitLink";
import { experimentMetadata } from "../experimentMetadata";
import ExperimentSchemas from "../ExperimentSchemas";
import Globe from "./Globe";

export const metadata = experimentMetadata("globe");

export default function GlobePage() {
  return (
    <main id="main" data-lab-stage="light" className="fixed inset-0 bg-white">
      <ExperimentSchemas slug="globe" />
      <LabExitLink tone="light" />

      <Globe />
    </main>
  );
}
