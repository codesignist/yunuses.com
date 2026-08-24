import LabExitLink from "components/atoms/LabExitLink";
import { experimentMetadata } from "../experimentMetadata";
import ExperimentSchemas from "../ExperimentSchemas";
import PingPong from "./PingPong";

export const metadata = experimentMetadata("3d-ping-pong");

export default function PingPongPage() {
  return (
    <main id="main" className="fixed inset-0 bg-black">
      <ExperimentSchemas slug="3d-ping-pong" />
      <LabExitLink />

      <PingPong />
    </main>
  );
}
