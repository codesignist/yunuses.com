import CursorTrailToggle from "components/atoms/CursorTrailToggle";
import ThemeToggle from "components/atoms/ThemeToggle";
import FullscreenToggle from "components/atoms/FullscreenToggle";

// Ekranin sag ustundeki dugme kumesi. Once her dugme kendi fixed konumunu
// piksel piksel tasiyordu (right-5, right-16, right-[108px]); bir tanesi
// gizlenince aralar bozuluyordu. Artik siralamayi tek bir satir belirliyor.
export default function ChromeControls() {
  return (
    <div className="fixed top-5 right-5 z-40 flex items-center gap-2">
      <CursorTrailToggle />
      <ThemeToggle />
      <FullscreenToggle />
    </div>
  );
}
