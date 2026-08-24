import LabExitLink from "components/atoms/LabExitLink";
import { experimentMetadata } from "../experimentMetadata";
import ExperimentSchemas from "../ExperimentSchemas";
import Dragon from "./Dragon";

export const metadata = experimentMetadata("dragon");

export default function DragonPage() {
  return (
    <main id="main" className="fixed inset-0 bg-black">
      <ExperimentSchemas slug="dragon" />
      <LabExitLink />

      <Dragon />
    </main>
  );
}
