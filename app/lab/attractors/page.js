import LabExitLink from "components/atoms/LabExitLink";
import { experimentMetadata } from "../experimentMetadata";
import ExperimentSchemas from "../ExperimentSchemas";
import Attractors from "./Attractors";

export const metadata = experimentMetadata("attractors");

export default function AttractorsPage() {
  return (
    <main id="main" className="fixed inset-0 bg-black">
      <ExperimentSchemas slug="attractors" />
      <LabExitLink />

      <Attractors />
    </main>
  );
}
